import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Step, StepStatus, StepType } from '../runs/entities/step.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { AgentRuntimeService, AgentContext } from '../agents/agent-runtime.service';
import { ContextSummarizerService } from '../agents/context-summarizer.service';
import { AtomicEventConverterService } from '../agents/atomic-event-converter.service';
import { ToolRuntimeService, ToolContext } from '../tools/tool-runtime.service';
import { BudgetTrackerService } from './budget-tracker.service';
import { ScopeDeniedException } from '../common/exceptions/scope-denied.exception';
import { PolicyEngineV1Service } from '../policies/policy-engine-v1.service';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private agentRuntime: AgentRuntimeService,
    private toolRuntime: ToolRuntimeService,
    private contextSummarizer: ContextSummarizerService,
    private atomicConverter: AtomicEventConverterService,
    private budgetTracker: BudgetTrackerService,
    private policyEngineV1: PolicyEngineV1Service,
  ) {}

  async startRun(
    workflowId: string,
    input: Record<string, any>,
    mode: 'draft' | 'auto' = 'draft',
    tenantId: string = 'default-tenant',
    userId?: string,
    appId?: string,
    appActionId?: string,
    policyContext?: Record<string, any>, // Optional: pre-evaluated policy context with modifications
  ): Promise<Run> {
    // Load workflow
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
    }

    // Apply policy modifications if any (from pre-evaluated policy context)
    let finalInput = { ...input, ...(policyContext?.input_modifications || {}) };
    let finalMode = policyContext?.mode_override || mode;

    // Policy check: Only if not already evaluated (policyContext not provided)
    if (!policyContext) {
      try {
        const policyDecision = await this.policyEngineV1.checkRunStart(workflowId, {
          appId,
          userId,
          tenantId,
          mode,
          input: finalInput,
        });

        if (!policyDecision.allowed) {
          this.logger.warn(
            `Policy denied run start: workflow ${workflowId} with mode ${mode}`,
            {
              workflowId,
              mode,
              appId,
              userId,
              tenantId,
              reason: policyDecision.reason,
            },
          );

          if (policyDecision.requiresApproval) {
            throw new BadRequestException(
              `Run requires approval: ${policyDecision.reason || 'Policy requires human approval'}`,
            );
          }

          throw new BadRequestException(
            `Policy denied run start: ${policyDecision.reason || 'Run not allowed'}`,
          );
        }

        // Apply any modifications from policy (e.g., force mode to draft)
        if (policyDecision.modifiedContext) {
          if (policyDecision.modifiedContext.mode_override) {
            finalMode = policyDecision.modifiedContext.mode_override as 'draft' | 'auto';
            this.logger.log(
              `Policy modified run mode to: ${finalMode}`,
              { workflowId, originalMode: mode, modifiedMode: policyDecision.modifiedContext.mode_override },
            );
          }
          if (policyDecision.modifiedContext.input_modifications) {
            Object.assign(finalInput, policyDecision.modifiedContext.input_modifications);
          }
        }
      } catch (error: any) {
        // If policy engine fails (e.g., no policies table yet), log and continue
        if (error instanceof BadRequestException) {
          throw error; // Re-throw policy denials
        }
        this.logger.warn(
          `Policy check failed, continuing without policy enforcement: ${error.message}`,
          { workflowId, mode },
        );
      }
    }

    // Create run
    const run = this.runRepository.create({
      workflow_id: workflowId,
      workflow_version: workflow.version,
      app_id: appId || null,
      app_action_id: appActionId || null,
      user_id: userId || null,
      tenant_id: tenantId,
      status: RunStatus.PENDING,
      mode: finalMode as any,
      input: finalInput,
      // Budget fields can be set via input or defaults
      cost_limit_cents: finalInput.cost_limit_cents || null,
      llm_calls_limit: finalInput.llm_calls_limit || null,
      latency_slo_ms: finalInput.latency_slo_ms || null,
    });

    const savedRun = await this.runRepository.save(run);

    // Initialize budget tracking
    this.budgetTracker.initializeRun(savedRun.id);

    // Emit run_started event
    await this.eventRepository.save({
      run_id: savedRun.id,
      kind: EventKind.RUN_STARTED,
      payload: { workflow_id: workflowId, input: finalInput, mode: finalMode },
    });

    // Execute workflow asynchronously (non-blocking)
    this.executeWorkflow(savedRun.id, workflow).catch((error) => {
      this.logger.error(
        `Error executing workflow ${workflowId}`,
        error instanceof Error ? error.stack : String(error),
        {
          workflow_id: workflowId,
          run_id: savedRun.id,
          tenant_id: tenantId,
          user_id: userId,
        },
      );
      // Error handling is done in executeWorkflow, but log here for visibility
    });

    // Return immediately - workflow executes in background
    return savedRun;
  }

  /**
   * Resume a paused run (e.g., after human approval)
   * @param runId - The run ID to resume
   * @param approvalInput - The human approval input (e.g., { approved: true, response: "..." })
   */
  async resumeRun(runId: string, approvalInput: Record<string, any>): Promise<Run> {
    const run = await this.runRepository.findOne({
      where: { id: runId },
      relations: ['workflow'],
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${runId} not found`);
    }

    if (run.status !== RunStatus.PAUSED) {
      throw new BadRequestException(
        `Run ${runId} is not paused. Current status: ${run.status}`,
      );
    }

    // Find the last pending step (waiting for approval)
    const pendingStep = await this.stepRepository.findOne({
      where: { run_id: runId, status: StepStatus.PENDING },
      order: { started_at: 'DESC' },
    });

    if (!pendingStep) {
      throw new BadRequestException(
        `No pending step found for run ${runId}. Cannot resume.`,
      );
    }

    // Update step with approval input
    pendingStep.status = StepStatus.COMPLETED;
    pendingStep.output = {
      ...pendingStep.output,
      approved: true,
      approval_input: approvalInput,
      approved_at: new Date().toISOString(),
    };
    pendingStep.finished_at = new Date();
    await this.stepRepository.save(pendingStep);

    // Log approval event
    await this.eventRepository.save({
      run_id: runId,
      step_id: pendingStep.id,
      kind: EventKind.STEP_COMPLETED,
      payload: {
        node_id: pendingStep.node_id,
        approval_input: approvalInput,
        message: 'Human approval received',
      },
    });

    // Resume workflow execution
    const workflow = await this.workflowRepository.findOne({
      where: { id: run.workflow_id },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${run.workflow_id} not found`);
    }

    // Update run status back to running
    run.status = RunStatus.RUNNING;
    run.result = null; // Clear pause result
    await this.runRepository.save(run);

    await this.eventRepository.save({
      run_id: runId,
      kind: EventKind.RUN_STARTED,
      payload: { message: 'Workflow execution resumed after approval' },
    });

    // Continue execution from where it left off
    // We need to resume from the node that was paused, so we'll continue the linear workflow
    // The executeLinearWorkflow will find the next node after the completed step
    this.resumeLinearWorkflow(runId, workflow, pendingStep.node_id).catch((error) => {
      this.logger.error(
        `Error resuming workflow ${run.workflow_id}`,
        error instanceof Error ? error.stack : String(error),
        {
          workflow_id: run.workflow_id,
          run_id: runId,
          tenant_id: run.tenant_id,
          user_id: run.user_id,
        },
      );
    });

    return run;
  }

  /**
   * Resume linear workflow execution from a specific node
   * This is called after a run is resumed from a paused state
   */
  private async resumeLinearWorkflow(
    runId: string,
    workflow: Workflow,
    fromNodeId: string,
  ): Promise<void> {
    const { definition } = workflow;
    const { nodes, edges = [] } = definition;

    // Find the node we're resuming from
    const fromNode = nodes.find((n) => n.id === fromNodeId);
    if (!fromNode) {
      throw new Error(`Node ${fromNodeId} not found in workflow`);
    }

    // Get the next node after the paused one
    let currentNode: string | null = await this.getNextNode(
      runId,
      fromNode,
      {}, // Step output is already saved in the step
      edges,
      nodes,
    );

    if (!currentNode) {
      // No next node, workflow is complete
      const run = await this.runRepository.findOne({ where: { id: runId } });
      if (run && run.status === RunStatus.RUNNING) {
        run.status = RunStatus.COMPLETED;
        const metrics = this.budgetTracker.getMetrics(runId);
        run.result = {
          message: 'Workflow completed successfully',
          ...(metrics && {
            cost_cents: metrics.costCents,
            llm_calls: metrics.llmCalls,
            duration_ms: Date.now() - metrics.startTime,
          }),
        };
        await this.runRepository.save(run);

        await this.eventRepository.save({
          run_id: runId,
          kind: EventKind.RUN_COMPLETED,
          payload: { result: run.result },
        });

        this.budgetTracker.cleanup(runId);
      }
      return;
    }

    // Continue execution from the next node
    const MAX_STEPS = 50;
    let stepCount = 0;

    while (currentNode) {
      stepCount++;
      if (stepCount > MAX_STEPS) {
        throw new Error(
          `Maximum step limit (${MAX_STEPS}) exceeded. This may indicate an infinite loop or a workflow that needs optimization.`,
        );
      }

      const node = nodes.find((n) => n.id === currentNode);
      if (!node) {
        throw new Error(`Node ${currentNode} not found`);
      }

      // Execute node and get output
      const stepOutput = await this.executeNode(runId, node);

      // Get the step we just executed to pass its output for routing
      const executedStep = await this.stepRepository.findOne({
        where: { run_id: runId, node_id: node.id },
        order: { started_at: 'DESC' },
      });

      // Determine next node based on node type and edges
      currentNode = await this.getNextNode(
        runId,
        node,
        executedStep?.output || stepOutput,
        edges,
        nodes,
      );
    }
  }

  private async executeWorkflow(runId: string, workflow: Workflow): Promise<void> {
    const run = await this.runRepository.findOne({ where: { id: runId } });
    if (!run) return;

    try {
      // Check budget before starting
      const budgetCheck = await this.budgetTracker.checkBudget(runId);
      if (budgetCheck.exceeded) {
        throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
      }

      // Update run status to running
      run.status = RunStatus.RUNNING;
      await this.runRepository.save(run);

      await this.eventRepository.save({
        run_id: runId,
        kind: EventKind.RUN_STARTED,
        payload: { message: 'Workflow execution started' },
      });

      // For linear workflows, execute nodes in order
      if (workflow.type === 'linear' || !workflow.type) {
        await this.executeLinearWorkflow(runId, workflow);
      } else {
        // For now, only support linear workflows
        throw new Error(`Workflow type ${workflow.type} not yet supported`);
      }

      // Check if run was cancelled before marking as completed
      const currentRun = await this.runRepository.findOne({ where: { id: runId } });
      if (currentRun?.status === RunStatus.CANCELLED) {
        this.logger.log(`Run ${runId} was cancelled, not marking as completed`);
        return; // Exit without marking as completed
      }

      // Mark run as completed
      run.status = RunStatus.COMPLETED;
      const metrics = this.budgetTracker.getMetrics(runId);
      run.result = {
        message: 'Workflow completed successfully',
        ...(metrics && {
          cost_cents: metrics.costCents,
          llm_calls: metrics.llmCalls,
          duration_ms: Date.now() - metrics.startTime,
        }),
      };
      await this.runRepository.save(run);

      await this.eventRepository.save({
        run_id: runId,
        kind: EventKind.RUN_COMPLETED,
        payload: { result: run.result },
      });

      // Cleanup budget tracking
      this.budgetTracker.cleanup(runId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown workflow error';

      // Check if run was cancelled before marking as failed
      const currentRun = await this.runRepository.findOne({ where: { id: runId } });
      if (currentRun?.status === RunStatus.CANCELLED) {
        this.logger.log(`Run ${runId} was cancelled, not marking as failed`);
        return; // Exit without marking as failed
      }

      // Mark run as failed
      run.status = RunStatus.FAILED;
      run.result = {
        error: errorMessage,
        error_type: error instanceof Error ? error.name : 'Unknown',
        ...(error instanceof Error && error.stack && { stack: error.stack }),
      };
      await this.runRepository.save(run);

      this.logger.error(
        `Workflow execution failed: ${workflow.id}`,
        error instanceof Error ? error.stack : String(error),
        {
          workflow_id: workflow.id,
          run_id: runId,
          tenant_id: run.tenant_id,
          user_id: run.user_id,
        },
      );

      await this.eventRepository.save({
        run_id: runId,
        kind: EventKind.RUN_FAILED,
        payload: {
          error: errorMessage,
          error_type: error instanceof Error ? error.name : 'Unknown',
          ...(error instanceof Error && error.stack && { stack: error.stack }),
          workflow_id: workflow.id,
        },
      });

      // Cleanup budget tracking
      this.budgetTracker.cleanup(runId);
    }
  }

  private async executeLinearWorkflow(
    runId: string,
    workflow: Workflow,
  ): Promise<void> {
    const { definition } = workflow;
    const { nodes, entryNode, edges = [] } = definition;

    // Find entry node
    const entry = nodes.find((n) => n.id === entryNode);
    if (!entry) {
      throw new Error(`Entry node ${entryNode} not found`);
    }

    // Dynamic execution: execute nodes and determine next node based on output
    // Allow cycles for patterns like Reflection/Retry, but limit total steps to prevent infinite loops
    const MAX_STEPS = 50; // Maximum steps per run to prevent infinite loops
    let stepCount = 0;
    let currentNode: string | null = entryNode;

    while (currentNode) {
      // Prevent infinite loops by limiting total steps
      stepCount++;
      if (stepCount > MAX_STEPS) {
        throw new Error(
          `Maximum step limit (${MAX_STEPS}) exceeded. This may indicate an infinite loop or a workflow that needs optimization.`,
        );
      }

      const node = nodes.find((n) => n.id === currentNode);
      if (!node) {
        throw new Error(`Node ${currentNode} not found`);
      }

      // Execute node and get output
      const stepOutput = await this.executeNode(runId, node);

      // Get the step we just executed to pass its output for routing
      const executedStep = await this.stepRepository.findOne({
        where: { run_id: runId, node_id: node.id },
        order: { started_at: 'DESC' },
      });

      // Determine next node based on node type and edges
      currentNode = await this.getNextNode(
        runId,
        node,
        executedStep?.output || stepOutput,
        edges,
        nodes,
      );
    }
  }

  private async getNextNode(
    runId: string,
    currentNode: { id: string; type: string; [key: string]: any },
    stepOutput: any,
    edges: Array<{ from: string; to: string; condition?: string }>,
    nodes: Array<{ id: string; type: string; [key: string]: any }>,
  ): Promise<string | null> {
    // Find all edges from current node
    const outgoingEdges = edges.filter((e) => e.from === currentNode.id);

    if (outgoingEdges.length === 0) {
      // No outgoing edges, workflow ends
      return null;
    }

    // If router node, use agent to determine route
    if (currentNode.type === 'router') {
      return await this.evaluateRouterNode(runId, currentNode, stepOutput, outgoingEdges);
    }

    // For conditional edges, evaluate conditions using agent
    const conditionalEdges = outgoingEdges.filter((e) => e.condition);
    if (conditionalEdges.length > 0) {
      // Use agent to evaluate conditions
      const selectedEdge = await this.evaluateConditionalEdges(
        runId,
        stepOutput,
        conditionalEdges,
      );
      if (selectedEdge) {
        return selectedEdge.to;
      }
    }

    // Default: take first edge without condition, or first edge if all have conditions
    const defaultEdge = outgoingEdges.find((e) => !e.condition) || outgoingEdges[0];
    return defaultEdge?.to || null;
  }

  private async evaluateRouterNode(
    runId: string,
    routerNode: { id: string; type: string; config?: any; [key: string]: any },
    stepOutput: any,
    outgoingEdges: Array<{ from: string; to: string; condition?: string }>,
  ): Promise<string | null> {
    const routerAgentId = routerNode.config?.router_agent_id || 'agent.router';
    const routes = routerNode.config?.routes || [];

    // Validate router configuration
    if (!routes || routes.length === 0) {
      this.logger.warn(
        `Router node ${routerNode.id} has no routes defined, using first outgoing edge`,
        { run_id: runId, node_id: routerNode.id },
      );
      return outgoingEdges[0]?.to || null;
    }

    // Validate routes have required fields
    for (const route of routes) {
      if (!route.id || !route.target_node) {
        this.logger.error(
          `Router node ${routerNode.id} has invalid route configuration`,
          { run_id: runId, node_id: routerNode.id, route },
        );
        throw new Error(`Invalid route configuration in router node ${routerNode.id}`);
      }
    }

    // Build routing context for agent - dignified, clear, helpful
    // Use atomic format for better LLM understanding
    let atomicContextMessage = '';
    try {
      const run = await this.runRepository.findOne({ where: { id: runId } });
      if (run) {
        const steps = await this.stepRepository.find({
          where: { run_id: runId },
          order: { started_at: 'ASC' },
          take: 10,
        });
        const events = await this.eventRepository.find({
          where: { run_id: runId },
          order: { ts: 'ASC' },
          take: 20,
        });

        const atomicContext = await this.atomicConverter.buildAtomicContextChain(
          steps,
          events,
          run,
        );
        atomicContextMessage = this.atomicConverter.formatAtomicContextForLLM(atomicContext);
      }
    } catch (error) {
      this.logger.warn(
        'Failed to build atomic context for routing, using fallback',
        error instanceof Error ? error.stack : String(error),
        { run_id: runId },
      );
    }

    const stepSummary = this.contextSummarizer.summarizeStepOutput(stepOutput);
    const routesDescription = routes
      .map((r: any, i: number) => {
        const routeNum = i + 1;
        const condition = r.condition ? ` (${r.condition})` : '';
        return `${routeNum}. Route "${r.id}"${condition} → goes to "${r.target_node}"`;
      })
      .join('\n');

    const routingPrompt = `You're helping route this workflow based on what we learned from the previous step.

${atomicContextMessage ? `${atomicContextMessage}\n\n` : ''}Here's what happened in the previous step:
${stepSummary}

Based on these results, we need to decide which route to take:

${routesDescription}

Consider the context and choose the most appropriate route. If you're unsure or need clarification, you can mention that.

Please respond with the route ID you think is most appropriate (e.g., "high_priority" or "normal").`;

    try {
      const run = await this.runRepository.findOne({ where: { id: runId } });
      if (!run) {
        throw new Error(`Run ${runId} not found`);
      }

      // Get previous step to build context
      const previousSteps = await this.stepRepository.find({
        where: { run_id: runId },
        order: { started_at: 'DESC' },
        take: 5,
      });

      const context: AgentContext = {
        runId,
        stepId: 'router-evaluation', // Temporary step ID
        appId: run.app_id || undefined,
        userId: run.user_id || undefined,
        tenantId: run.tenant_id,
        workflowInput: run.input,
        previousSteps: previousSteps.map((s) => ({
          node_id: s.node_id,
          output: s.output,
        })),
      };

      // Call router agent
      const result = await this.agentRuntime.runAgentStep(
        routerAgentId,
        context,
        routingPrompt,
      );

      // Extract route ID from agent response
      const routeId = this.extractRouteId(result.text, routes);

      // Log routing decision
      this.logger.log(
        `Router node ${routerNode.id} selected route: ${routeId}`,
        { run_id: runId, node_id: routerNode.id, route_id: routeId, agent_response: result.text },
      );

      // Find edge matching the route
      const selectedRoute = routes.find((r: any) => r.id === routeId);
      if (selectedRoute) {
        // Log successful routing
        await this.eventRepository.save({
          run_id: runId,
          kind: EventKind.POLICY_EVAL,
          payload: {
            type: 'router_decision',
            node_id: routerNode.id,
            route_id: routeId,
            target_node: selectedRoute.target_node,
            agent_response: result.text,
          },
        });
        return selectedRoute.target_node;
      }

      // Fallback: use first route (log warning)
      this.logger.warn(
        `Router node ${routerNode.id} could not match route "${routeId}", using fallback`,
        { run_id: runId, node_id: routerNode.id, route_id: routeId, available_routes: routes.map((r: any) => r.id) },
      );
      if (routes.length > 0) {
        return routes[0].target_node;
      }

      // No routes defined, use first outgoing edge
      return outgoingEdges[0]?.to || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown router error';

      this.logger.warn(
        `Router node evaluation failed, using fallback route`,
        error instanceof Error ? error.stack : String(error),
        {
          router_node_id: routerNode.id,
          run_id: runId,
          routes_count: routes.length,
        },
      );

      // Graceful degradation: use first route or first edge
      if (routes.length > 0) {
        this.logger.log(
          `Using fallback route: ${routes[0].target_node}`,
          { router_node_id: routerNode.id, run_id: runId },
        );
        return routes[0].target_node;
      }
      return outgoingEdges[0]?.to || null;
    }
  }

  private extractRouteId(agentResponse: string, routes: Array<{ id: string }>): string {
    // Try to extract route ID from agent response
    const responseLower = agentResponse.toLowerCase().trim();

    // Check for exact match
    for (const route of routes) {
      if (responseLower === route.id.toLowerCase() || responseLower.includes(route.id.toLowerCase())) {
        return route.id;
      }
    }

    // Try to extract quoted string
    const quotedMatch = agentResponse.match(/"([^"]+)"/);
    if (quotedMatch) {
      const quotedId = quotedMatch[1];
      if (routes.some((r) => r.id === quotedId)) {
        return quotedId;
      }
    }

    // Default to first route
    return routes[0]?.id || '';
  }

  private async evaluateConditionalEdges(
    runId: string,
    stepOutput: any,
    conditionalEdges: Array<{ from: string; to: string; condition?: string }>,
  ): Promise<{ from: string; to: string; condition?: string } | null> {
    // Use a default condition evaluation agent
    const conditionAgentId = 'agent.condition_evaluator';

    // Build condition evaluation prompt - dignified, clear, helpful
    // Use atomic format for better LLM understanding
    let atomicContextMessage = '';
    try {
      const run = await this.runRepository.findOne({ where: { id: runId } });
      if (run) {
        const steps = await this.stepRepository.find({
          where: { run_id: runId },
          order: { started_at: 'ASC' },
          take: 10,
        });
        const events = await this.eventRepository.find({
          where: { run_id: runId },
          order: { ts: 'ASC' },
          take: 20,
        });

        const atomicContext = await this.atomicConverter.buildAtomicContextChain(
          steps,
          events,
          run,
        );
        atomicContextMessage = this.atomicConverter.formatAtomicContextForLLM(atomicContext);
      }
    } catch (error) {
      this.logger.warn(
        'Failed to build atomic context for condition evaluation, using fallback',
        error instanceof Error ? error.stack : String(error),
        { run_id: runId },
      );
    }

    const stepSummary = this.contextSummarizer.summarizeStepOutput(stepOutput);
    const conditionsDescription = conditionalEdges
      .map((e, i) => {
        const condNum = i + 1;
        return `${condNum}. If ${e.condition} → proceed to "${e.to}"`;
      })
      .join('\n');

    const conditionPrompt = `You're helping evaluate which condition applies based on the step results.

${atomicContextMessage ? `${atomicContextMessage}\n\n` : ''}Here's what we found in the previous step:
${stepSummary}

Based on these results, which condition is true?

${conditionsDescription}

Consider the context carefully. If none of the conditions match, respond with "0".

Please respond with the number (1, 2, 3, etc.) of the condition that applies, or "0" if none match.`;

    try {
      const run = await this.runRepository.findOne({ where: { id: runId } });
      if (!run) {
        return null;
      }

      // Load previous steps for context (limit to last 10 for performance)
      const previousSteps = await this.stepRepository.find({
        where: { run_id: runId },
        order: { started_at: 'ASC' },
        take: 10, // Limit to last 10 steps to avoid context bloat
      });

      const context: AgentContext = {
        runId,
        stepId: 'condition-evaluation',
        appId: run.app_id || undefined,
        userId: run.user_id || undefined,
        tenantId: run.tenant_id,
        workflowInput: run.input,
        previousSteps: previousSteps
          .filter((s) => s.status === 'completed') // Only completed steps
          .map((s) => ({
            node_id: s.node_id,
            output: s.output,
          })),
      };

      const result = await this.agentRuntime.runAgentStep(
        conditionAgentId,
        context,
        conditionPrompt,
      );

      // Extract number from response
      const numberMatch = result.text.match(/\d+/);
      if (numberMatch) {
        const index = parseInt(numberMatch[0], 10) - 1;
        if (index >= 0 && index < conditionalEdges.length) {
          return conditionalEdges[index];
        }
      }

      return null;
    } catch (error) {
      console.error('Error evaluating conditional edges:', error);
      return null;
    }
  }

  private async executeNode(
    runId: string,
    node: { id: string; type: string; [key: string]: any },
  ): Promise<any> {
    // Load run for context
    const run = await this.runRepository.findOne({ where: { id: runId } });
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    // Create step
    const step = this.stepRepository.create({
      run_id: runId,
      node_id: node.id,
      type: this.mapNodeTypeToStepType(node.type),
      status: StepStatus.PENDING,
      input: { node },
    });

    const savedStep = await this.stepRepository.save(step);

    await this.eventRepository.save({
      run_id: runId,
      step_id: savedStep.id,
      kind: EventKind.STEP_STARTED,
      payload: { node_id: node.id, node_type: node.type },
    });

    try {
      // Update step to running
      savedStep.status = StepStatus.RUNNING;
      await this.stepRepository.save(savedStep);

      // Execute node based on type
      let output: any = null;
      switch (node.type) {
        case 'static':
          output = await this.executeStaticNode(node);
          break;
        case 'agent':
          output = await this.executeAgentNode(runId, savedStep.id, node, run);
          break;
        case 'tool':
          output = await this.executeToolNode(runId, savedStep.id, node, run);
          break;
        case 'router':
          // Router nodes don't produce output, they determine routing
          // The routing decision is made in getNextNode
          output = { type: 'router', node_id: node.id };
          break;
        case 'human_gate':
          // Human gate: pause for human approval (future implementation)
          output = { 
            type: 'human_gate', 
            node_id: node.id,
            message: 'Waiting for human approval',
            requires_approval: true,
          };
          // For now, continue execution (in future, would pause here)
          break;
        default:
          output = { message: `Unknown node type: ${node.type}` };
      }

      // Mark step as completed
      savedStep.status = StepStatus.COMPLETED;
      savedStep.output = output;
      savedStep.finished_at = new Date();
      await this.stepRepository.save(savedStep);

      await this.eventRepository.save({
        run_id: runId,
        step_id: savedStep.id,
        kind: EventKind.STEP_COMPLETED,
        payload: { node_id: node.id, output },
      });

      // Return output for routing decisions
      return output;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown node execution error';
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Mark step as failed with enhanced error information
      savedStep.status = StepStatus.FAILED;
      savedStep.output = {
        error: errorMessage,
        error_type: errorName,
        error_name: errorName,
        ...(errorStack && { stack: errorStack }),
        timestamp: new Date().toISOString(),
        node_id: node.id,
        node_type: node.type,
      };
      savedStep.finished_at = new Date();
      await this.stepRepository.save(savedStep);

      const run = await this.runRepository.findOne({ where: { id: runId } });
      
      // Build enhanced error context
      const errorContext = {
        run_id: runId,
        step_id: savedStep.id,
        node_id: node.id,
        node_type: node.type,
        workflow_id: run?.workflow_id,
        app_id: run?.app_id,
        tenant_id: run?.tenant_id,
        user_id: run?.user_id,
        error_details: {
          name: errorName,
          message: errorMessage,
          ...(errorStack && { stack: errorStack }),
        },
        timestamp: new Date().toISOString(),
      };

      // Verbose error logging
      this.logger.error(
        `Step execution failed: ${node.id} (${node.type}) | Run: ${runId} | Error: ${errorName}: ${errorMessage}`,
        errorStack || String(error),
        errorContext,
      );

      await this.eventRepository.save({
        run_id: runId,
        step_id: savedStep.id,
        kind: EventKind.STEP_FAILED,
        payload: {
          node_id: node.id,
          node_type: node.type,
          error: errorMessage,
          error_type: errorName,
          error_name: errorName,
          ...(errorStack && { stack: errorStack }),
          context: errorContext,
          timestamp: new Date().toISOString(),
        },
      });

      // For router nodes, try to use fallback route
      if (node.type === 'router') {
        this.logger.warn(
          `Router node failed, attempting fallback route | Node: ${node.id} | Run: ${runId}`,
          {
            node_id: node.id,
            run_id: runId,
            workflow_id: run?.workflow_id,
            error: errorMessage,
          },
        );
        // Could implement fallback logic here
      }

      throw error;
    }
  }

  private async executeStaticNode(node: {
    id: string;
    type: string;
    [key: string]: any;
  }): Promise<any> {
    // For static nodes, return the configured output or input
    return node.output || node.value || { message: 'Static node executed' };
  }

  private async executeAgentNode(
    runId: string,
    stepId: string,
    node: { id: string; type: string; config?: any; [key: string]: any },
    run: Run,
  ): Promise<any> {
    const agentId = node.config?.agent_id;
    if (!agentId) {
      throw new Error(`Agent node ${node.id} missing agent_id in config`);
    }

    // Load previous steps for context (limit to last 10 for performance)
    const previousSteps = await this.stepRepository.find({
      where: { run_id: runId },
      order: { started_at: 'ASC' },
      take: 10, // Limit to last 10 steps to avoid context bloat
    });

    // Build agent context
    const context: AgentContext = {
      runId,
      stepId,
      appId: run.app_id || undefined,
      userId: run.user_id || undefined,
      tenantId: run.tenant_id,
      workflowInput: run.input,
      previousSteps: previousSteps
        .filter((s) => s.status === 'completed') // Only completed steps
        .map((s) => ({
          node_id: s.node_id,
          output: s.output,
        })),
    };

    // Execute agent
    const result = await this.agentRuntime.runAgentStep(
      agentId,
      context,
      node.config?.input || run.input,
    );

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      finishReason: result.finishReason,
    };
  }

  private async executeToolNode(
    runId: string,
    stepId: string,
    node: { id: string; type: string; config?: any; [key: string]: any },
    run: Run,
  ): Promise<any> {
    const toolId = node.config?.tool_id;
    if (!toolId) {
      throw new Error(`Tool node ${node.id} missing tool_id in config`);
    }

    // Build tool context
    const context: ToolContext = {
      runId,
      stepId,
      appId: run.app_id || undefined,
      userId: run.user_id || undefined,
      tenantId: run.tenant_id,
    };

    // Get tool input from node config or workflow input
    const toolInput = node.config?.input || run.input || {};

    // Execute tool
    try {
      const result = await this.toolRuntime.callTool(toolId, toolInput, context);
      return result;
    } catch (error: any) {
      // Check if error is due to require_approval
      if (error instanceof ScopeDeniedException && error.message.includes('requires approval')) {
        // Pause the run and mark step as pending (waiting for approval)
        this.logger.warn(`Run ${runId} paused: tool call requires approval`, {
          stepId,
          nodeId: node.id,
          error: error.message,
        });

        // Update step status to pending (waiting for approval)
        const step = await this.stepRepository.findOne({ where: { id: stepId } });
        if (step) {
          step.status = StepStatus.PENDING; // Keep as pending (waiting for approval)
          step.output = {
            error: 'requires_approval',
            message: error.message,
            paused_at: new Date().toISOString(),
          };
          await this.stepRepository.save(step);
        }

        // Update run status to paused
        run.status = RunStatus.PAUSED;
        run.result = {
          paused: true,
          reason: 'tool_call_requires_approval',
          step_id: stepId,
          node_id: node.id,
          message: error.message,
        };
        await this.runRepository.save(run);

        // Log event
        await this.eventRepository.save({
          run_id: runId,
          step_id: stepId,
          kind: EventKind.ERROR,
          payload: {
            error: 'requires_approval',
            message: error.message,
            step_id: stepId,
            node_id: node.id,
          },
        });

        // Throw error to stop execution
        throw error;
      }

      // Re-throw other errors
      throw error;
    }
  }

  private mapNodeTypeToStepType(nodeType: string): StepType {
    const mapping: Record<string, StepType> = {
      agent: StepType.AGENT,
      tool: StepType.TOOL,
      router: StepType.ROUTER,
      static: StepType.STATIC,
      human_gate: StepType.HUMAN_GATE,
    };

    return mapping[nodeType] || StepType.STATIC;
  }
}

