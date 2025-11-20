import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Step, StepStatus, StepType } from '../runs/entities/step.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { AgentRuntimeService, AgentContext } from '../agents/agent-runtime.service';
import { ToolRuntimeService, ToolContext } from '../tools/tool-runtime.service';

@Injectable()
export class OrchestratorService {
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
  ) {}

  async startRun(
    workflowId: string,
    input: Record<string, any>,
    mode: 'draft' | 'auto' = 'draft',
    tenantId: string = 'default-tenant',
    userId?: string,
    appId?: string,
    appActionId?: string,
  ): Promise<Run> {
    // Load workflow
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
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
      mode: mode as any,
      input,
    });

    const savedRun = await this.runRepository.save(run);

    // Emit run_started event
    await this.eventRepository.save({
      run_id: savedRun.id,
      kind: EventKind.RUN_STARTED,
      payload: { workflow_id: workflowId, input },
    });

    // Execute workflow asynchronously (non-blocking)
    this.executeWorkflow(savedRun.id, workflow).catch((error) => {
      console.error(`Error executing workflow ${workflowId}:`, error);
      // Error handling is done in executeWorkflow, but log here for visibility
    });

    // Return immediately - workflow executes in background
    return savedRun;
  }

  private async executeWorkflow(runId: string, workflow: Workflow): Promise<void> {
    const run = await this.runRepository.findOne({ where: { id: runId } });
    if (!run) return;

    try {
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

      // Mark run as completed
      run.status = RunStatus.COMPLETED;
      run.result = { message: 'Workflow completed successfully' };
      await this.runRepository.save(run);

      await this.eventRepository.save({
        run_id: runId,
        kind: EventKind.RUN_COMPLETED,
        payload: { result: run.result },
      });
    } catch (error) {
      // Mark run as failed
      run.status = RunStatus.FAILED;
      run.result = { error: error.message };
      await this.runRepository.save(run);

      await this.eventRepository.save({
        run_id: runId,
        kind: EventKind.RUN_FAILED,
        payload: { error: error.message, stack: error.stack },
      });
    }
  }

  private async executeLinearWorkflow(
    runId: string,
    workflow: Workflow,
  ): Promise<void> {
    const { definition } = workflow;
    const { nodes, entryNode } = definition;

    // Find entry node
    const entry = nodes.find((n) => n.id === entryNode);
    if (!entry) {
      throw new Error(`Entry node ${entryNode} not found`);
    }

    // Build execution order (simple linear traversal)
    const executionOrder: string[] = [entryNode];
    let currentNode = entryNode;

    // Follow edges to build execution order
    const edges = definition.edges || [];
    while (true) {
      const nextEdge = edges.find((e) => e.from === currentNode);
      if (!nextEdge) break;
      executionOrder.push(nextEdge.to);
      currentNode = nextEdge.to;
    }

    // Execute each node in order
    for (const nodeId of executionOrder) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      await this.executeNode(runId, node);
    }
  }

  private async executeNode(
    runId: string,
    node: { id: string; type: string; [key: string]: any },
  ): Promise<void> {
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
        case 'human_gate':
          // Placeholder for future implementation
          output = { message: `Node type ${node.type} not yet implemented` };
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
    } catch (error) {
      // Mark step as failed
      savedStep.status = StepStatus.FAILED;
      savedStep.output = { error: error.message };
      savedStep.finished_at = new Date();
      await this.stepRepository.save(savedStep);

      await this.eventRepository.save({
        run_id: runId,
        step_id: savedStep.id,
        kind: EventKind.STEP_FAILED,
        payload: { node_id: node.id, error: error.message },
      });

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

    // Build agent context
    const context: AgentContext = {
      runId,
      stepId,
      appId: run.app_id || undefined,
      userId: run.user_id || undefined,
      tenantId: run.tenant_id,
      workflowInput: run.input,
      previousSteps: [], // TODO: Load previous steps if needed
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
    const result = await this.toolRuntime.callTool(toolId, toolInput, context);

    return result;
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

