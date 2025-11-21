import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { Tool } from '../tools/entities/tool.entity';
import { LlmRouterService, LlmConfig } from '../llm/llm-router.service';
import { ToolRuntimeService, ToolContext } from '../tools/tool-runtime.service';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Step } from '../runs/entities/step.entity';
import { Run } from '../runs/entities/run.entity';
import { ContextSummarizerService } from './context-summarizer.service';
import { AtomicEventConverterService } from './atomic-event-converter.service';
import { TdlnTService } from '../tdln-t/tdln-t.service';
import { AgentNotFoundException } from '../common/exceptions/agent-not-found.exception';
import { AgentExecutionException } from '../common/exceptions/agent-execution.exception';
import { AgentInputValidatorService } from '../common/validators/agent-input-validator.service';
import { BudgetTrackerService } from '../execution/budget-tracker.service';
import { MemoryService } from '../memory/memory.service';
import { PolicyEngineV1Service } from '../policies/policy-engine-v1.service';
import { ContractsService } from '../registry/contracts/contracts.service';
import { RegistryContract } from '../registry/contracts/entities/registry-contract.entity';
import { ScopeDeniedException } from '../common/exceptions/scope-denied.exception';
import { tool } from 'ai';
import { z } from 'zod';
import { CoreMessage } from 'ai';

export interface AgentContext extends ToolContext {
  workflowInput?: any;
  previousSteps?: any[];
}

export interface AgentResult {
  text: string;
  toolCalls?: Array<{
    toolId: string;
    toolName: string;
    args: any;
    result?: any;
  }>;
  finishReason?: string;
}

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    private llmRouter: LlmRouterService,
    private toolRuntime: ToolRuntimeService,
    private contextSummarizer: ContextSummarizerService,
    private atomicConverter: AtomicEventConverterService,
    private tdlnTService: TdlnTService,
    private agentInputValidator: AgentInputValidatorService,
    private budgetTracker: BudgetTrackerService,
    private memoryService: MemoryService,
    private policyEngineV1: PolicyEngineV1Service,
    private contractsService: ContractsService,
  ) {}

  async runAgentStep(
    agentId: string,
    context: AgentContext,
    input?: any,
  ): Promise<AgentResult> {
    // Validate agent ID
    this.agentInputValidator.validateAgentId(agentId);

    // Validate agent context
    this.agentInputValidator.validateAgentContext(context);

    // Check if task is deterministic (can use TDLN-T instead of LLM)
    if (this.tdlnTService.isDeterministicTask(input)) {
      try {
        const result = await this.tdlnTService.handleDeterministicTask(input);
        // Log as event
        await this.eventRepository.save({
          run_id: context.runId,
          step_id: context.stepId,
          kind: EventKind.TOOL_CALL,
          payload: {
            tool_id: 'tdln-t',
            input,
            output: result,
            method: 'deterministic',
            cost: 0,
          },
        });
        return {
          text: result.text || JSON.stringify(result),
          toolCalls: [],
          finishReason: 'stop',
        };
      } catch (error) {
        // If deterministic handling fails, fall back to LLM
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        
        this.logger.warn(
          `Deterministic task handling failed for agent ${agentId}, falling back to LLM | Error: ${errorName}: ${errorMessage}`,
          {
            agent_id: agentId,
            run_id: context.runId,
            step_id: context.stepId,
            error_details: {
              name: errorName,
              message: errorMessage,
              ...(error instanceof Error && error.stack && { stack: error.stack }),
            },
          },
        );
      }
    }

    const logContext = {
      agent_id: agentId,
      run_id: context.runId,
      step_id: context.stepId,
      user_id: context.userId,
      tenant_id: context.tenantId,
    };

    this.logger.log(`Running agent step: ${agentId}`, logContext);

    // Load agent from database
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      this.logger.error(`Agent not found: ${agentId}`, undefined, logContext);
      throw new AgentNotFoundException(agentId, logContext);
    }

    // Policy Engine v1 check (BEFORE agent execution)
    try {
      const policyDecision = await this.policyEngineV1.checkAgentCall(agentId, {
        runId: context.runId,
        appId: context.appId,
        userId: context.userId,
        tenantId: context.tenantId,
      });

      if (!policyDecision.allowed) {
        // Log policy denial
        await this.eventRepository.save({
          run_id: context.runId,
          step_id: context.stepId,
          kind: EventKind.POLICY_EVAL,
          payload: {
            action: 'agent_call',
            agent_id: agent.id,
            app_id: context.appId,
            user_id: context.userId,
            tenant_id: context.tenantId,
            result: 'denied',
            reason: policyDecision.reason || 'Policy denied agent call',
          },
        });

        this.logger.warn(
          `Policy denied agent call: ${agentId}`,
          undefined,
          { ...logContext, reason: policyDecision.reason },
        );

        if (policyDecision.requiresApproval) {
          throw new ScopeDeniedException(
            context.appId || 'system',
            'agent',
            agentId,
            logContext,
          );
        }

        throw new ScopeDeniedException(
          context.appId || 'system',
          'agent',
          agentId,
          logContext,
        );
      }

      // Log policy allowance
      await this.eventRepository.save({
        run_id: context.runId,
        step_id: context.stepId,
        kind: EventKind.POLICY_EVAL,
        payload: {
          action: 'agent_call',
          agent_id: agent.id,
          app_id: context.appId,
          user_id: context.userId,
          tenant_id: context.tenantId,
          result: 'allowed',
          reason: policyDecision.reason || 'Policy allows agent call',
        },
      });

      // Apply policy modifications if any
      if (policyDecision.modifiedContext) {
        this.logger.debug(
          `Policy modified context for agent call: ${agentId}`,
          { ...logContext, modifications: policyDecision.modifiedContext },
        );
      }
    } catch (error) {
      // If policy check throws (e.g., agent/run not found), log and re-throw
      if (error instanceof ScopeDeniedException) {
        throw error;
      }
      
      // CRITICAL SECURITY: Fail-closed by default (configurable via env)
      const failOpen = process.env.POLICY_FAIL_OPEN === 'true';
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      this.logger.error(
        `Policy check failed for agent: ${agentId} | Error: ${errorName}: ${errorMessage}`,
        error instanceof Error ? error.stack : String(error),
        {
          ...logContext,
          error_details: {
            name: errorName,
            message: errorMessage,
            ...(error instanceof Error && error.stack && { stack: error.stack }),
          },
        },
      );
      
      if (!failOpen) {
        // Fail closed: deny execution when policy engine fails
        this.logger.error(
          `Policy engine failure → failing closed (POLICY_FAIL_OPEN=false)`,
          undefined,
          { ...logContext, policy_error: errorMessage },
        );
        
        await this.eventRepository.save({
          run_id: context.runId,
          step_id: context.stepId,
          kind: EventKind.POLICY_EVAL,
          payload: {
            action: 'agent_call',
            agent_id: agent.id,
            app_id: context.appId,
            user_id: context.userId,
            tenant_id: context.tenantId,
            result: 'denied',
            reason: 'policy_engine_failure',
            policy_error: errorMessage,
          },
        });
        
        throw new ScopeDeniedException(
          context.appId || 'system',
          'agent',
          agentId,
          { ...logContext, policy_error: errorMessage },
        );
      } else {
        // Fail open: allow execution when policy engine fails (development only)
        this.logger.warn(
          `Policy engine failure → failing open (POLICY_FAIL_OPEN=true)`,
          undefined,
          { ...logContext, policy_error: errorMessage },
        );
      }
    }

    // Load allowed tools
    const toolIds = agent.allowed_tools || [];
    const tools = await Promise.all(
      toolIds.map((id) => this.toolRepository.findOne({ where: { id } })),
    );
    const validTools = tools.filter((t) => t !== null) as Tool[];

    // Convert tools to AI SDK format
    const aiTools: Record<string, any> = {};

    for (const toolEntity of validTools) {
      // Convert input schema to Zod schema
      const zodSchema = this.jsonSchemaToZod(toolEntity.input_schema);

      // Create tool using AI SDK's tool function
      const toolDefinition = {
        description: toolEntity.description || toolEntity.name,
        parameters: zodSchema,
        execute: async (params: any) => {
          // Execute tool via tool runtime
          return await this.toolRuntime.callTool(
            toolEntity.id,
            params,
            context,
          );
        },
      };
      
      aiTools[toolEntity.id] = tool(toolDefinition as any);
    }

    // Build prompt from agent config (now async to fetch atomic context)
    let activeContract: RegistryContract | null = null;
    if (agent.active_contract_id) {
      try {
        activeContract = await this.contractsService.findOne(agent.active_contract_id);
      } catch (error) {
        this.logger.warn(`Failed to load active contract ${agent.active_contract_id} for agent ${agentId}`);
      }
    }

    const messages = await this.buildPrompt(agent, context, input, activeContract);

    // Get LLM config from agent
    const llmConfig: LlmConfig = {
      provider: agent.model_profile.provider,
      model: agent.model_profile.model,
      temperature: agent.model_profile.temperature,
      maxTokens: agent.model_profile.max_tokens,
    };

    // Check budget before LLM call
    const budgetCheck = await this.budgetTracker.checkBudget(context.runId);
    if (budgetCheck.exceeded) {
      throw new AgentExecutionException(
        agentId,
        `Budget exceeded: ${budgetCheck.reason}`,
        new Error(`Budget limit reached: ${budgetCheck.reason}`),
        { runId: context.runId, stepId: context.stepId },
      );
    }

    // Generate with tool calling (with retry and error handling)
    const result = await this.llmRouter.generateText(
      messages,
      llmConfig,
      aiTools,
      {
        agentId,
        runId: context.runId,
        stepId: context.stepId,
      },
    );

    // Track LLM call and estimate cost
    this.budgetTracker.incrementLlmCalls(context.runId);
    
    // Estimate cost (rough approximation - can be improved with actual pricing API)
    // AI SDK v5 returns usage in result.usage
    const usage = (result as any).usage || { promptTokens: 0, completionTokens: 0 };
    const estimatedCostCents = this.estimateLlmCost(llmConfig, usage);
    if (estimatedCostCents > 0) {
      this.budgetTracker.addCost(context.runId, estimatedCostCents);
    }

    // Log LLM call as event (with PII protection)
    const logLlmContent = process.env.LOG_LLM_CONTENT !== 'false'; // Default: true (dev/staging)
    
    let eventPayload: any = {
      agent_id: agentId,
      model: llmConfig.model,
      provider: llmConfig.provider,
      finishReason: result.finishReason,
      usage: usage,
      estimated_cost_cents: estimatedCostCents,
    };

    if (logLlmContent) {
      // Full logging (dev/staging)
      eventPayload.prompt = messages;
      eventPayload.response = result.text;
    } else {
      // PII-protected logging (production)
      // Generate hash of prompt for correlation
      const crypto = require('crypto');
      const promptHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(messages))
        .digest('hex')
        .substring(0, 16);
      
      eventPayload.prompt_hash = promptHash;
      eventPayload.response_length = result.text?.length || 0;
      eventPayload.pii_protected = true;
    }

    await this.eventRepository.save({
      run_id: context.runId,
      step_id: context.stepId,
      kind: EventKind.LLM_CALL,
      payload: eventPayload,
    });

    // Process tool calls
    const toolCalls: AgentResult['toolCalls'] = [];
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        try {
          // Extract tool name and args from tool call
          const toolCallAny = toolCall as any;
          const toolName = toolCallAny.toolName || toolCallAny.tool || 'unknown';
          const args = toolCallAny.args || toolCallAny.parameters || toolCallAny.input || {};

          // Execute tool call via tool runtime
          const toolResult = await this.toolRuntime.callTool(
            toolName,
            args,
            context,
          );

          toolCalls.push({
            toolId: toolName,
            toolName: toolName,
            args: args,
            result: toolResult,
          });
        } catch (error: any) {
          const toolCallAny = toolCall as any;
          const toolName = toolCallAny.toolName || toolCallAny.tool || 'unknown';
          const args = toolCallAny.args || toolCallAny.parameters || toolCallAny.input || {};
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          
          // Log tool call failure with context
          this.logger.error(
            `Tool call failed during agent execution: ${toolName} | Agent: ${agentId} | Error: ${errorName}: ${errorMessage}`,
            error instanceof Error ? error.stack : String(error),
            {
              agent_id: agent.id,
              run_id: context.runId,
              step_id: context.stepId,
              tool_name: toolName,
              tool_args: args,
              error_details: {
                name: errorName,
                message: errorMessage,
                ...(error instanceof Error && error.stack && { stack: error.stack }),
              },
            },
          );
          
          toolCalls.push({
            toolId: toolName,
            toolName: toolName,
            args: args,
            result: {
              error: errorMessage,
              error_type: errorName,
              ...(error instanceof Error && error.stack && { stack: error.stack }),
            },
          });
        }
      }
    }

    // Store agent decision/conclusion as long-term memory (if significant)
    // This helps future agents learn from past decisions
    try {
      if (result.text && result.text.length > 50 && context.runId) {
        // Only store if the response is substantial
        await this.memoryService.storeMemory({
          owner_type: 'run',
          owner_id: context.runId,
          type: 'long_term',
          content: `Agent ${agentId} decision: ${result.text.substring(0, 1000)}`,
          metadata: {
            agent_id: agent.id,
            step_id: context.stepId,
            tool_calls: toolCalls.length || 0,
            finish_reason: result.finishReason,
          },
          visibility: 'private',
          generateEmbedding: true,
        });
      }
    } catch (error) {
      // Don't fail the agent execution if memory storage fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      this.logger.warn(
        `Failed to store agent memory for agent ${agentId} | Error: ${errorName}: ${errorMessage}`,
        {
          agent_id: agent.id,
          run_id: context.runId,
          step_id: context.stepId,
          error_details: {
            name: errorName,
            message: errorMessage,
            ...(error instanceof Error && error.stack && { stack: error.stack }),
          },
        },
      );
    }

    return {
      text: result.text,
      toolCalls,
      finishReason: result.finishReason,
    };
  }

  /**
   * Estimate LLM cost in cents (rough approximation)
   * TODO: Use actual pricing API for accurate costs
   */
  private estimateLlmCost(
    config: LlmConfig,
    usage?: { promptTokens?: number; completionTokens?: number },
  ): number {
    if (!usage) return 0;

    // Rough pricing estimates (in cents per 1K tokens)
    const pricing: Record<string, Record<string, { input: number; output: number }>> = {
      openai: {
        'gpt-4o': { input: 2.5, output: 10 }, // $0.025/$0.10 per 1K tokens
        'gpt-4-turbo': { input: 10, output: 30 },
        'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      },
      anthropic: {
        'claude-3-5-sonnet': { input: 3, output: 15 },
        'claude-3-opus': { input: 15, output: 75 },
      },
      google: {
        'gemini-pro': { input: 0.5, output: 1.5 },
      },
    };

    const modelPricing = pricing[config.provider]?.[config.model];
    if (!modelPricing) return 0;

    const inputCost = ((usage.promptTokens || 0) / 1000) * modelPricing.input;
    const outputCost = ((usage.completionTokens || 0) / 1000) * modelPricing.output;

    return Math.ceil(inputCost + outputCost);
  }


  private async buildPrompt(
    agent: Agent,
    context: AgentContext,
    input?: any,
    activeContract?: RegistryContract | null,
  ): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    // System message from agent instructions - add dignity and clarity
    if (agent.instructions) {
      let enhancedInstructions = this.enhanceInstructions(agent.instructions);
      
      // Inject Contract Context
      if (activeContract) {
        enhancedInstructions += `\n\nIMPORTANT: You are operating under a legally binding contract (${activeContract.titulo}).
Status: ${activeContract.estado_atual}
Scope: ${activeContract.escopo ? activeContract.escopo.join(', ') : 'As defined in instructions'}
Budget Limit: ${activeContract.valor_total_cents ? (activeContract.valor_total_cents / 100).toFixed(2) + ' ' + activeContract.moeda : 'N/A'}
Deadline: ${activeContract.data_limite ? activeContract.data_limite.toISOString().split('T')[0] : 'N/A'}

You MUST adhere to these constraints. Actions outside this scope may lead to contract penalties.`;
      }

      messages.push({
        role: 'system',
        content: enhancedInstructions,
      });
    }

    // Build atomic context for LLM understanding (reduces hallucinations, prevents forgetting)
    let atomicContextMessage = '';
    try {
      if (context.runId) {
        const run = await this.runRepository.findOne({ where: { id: context.runId } });
        if (run) {
          // Fetch steps and events for atomic context
          // Get last 20 steps (most recent first, then reverse for chronological order)
          const recentSteps = await this.stepRepository.find({
            where: { run_id: context.runId },
            order: { started_at: 'DESC' },
            take: 20, // Limit to recent steps
          });
          const steps = recentSteps.reverse(); // Reverse to maintain chronological order

          // Get last 50 events (most recent first, then reverse for chronological order)
          // Use secondary ordering by id for deterministic ordering
          const recentEvents = await this.eventRepository.find({
            where: { run_id: context.runId },
            order: { ts: 'DESC', id: 'DESC' },
            take: 50, // Limit to recent events
          });
          const events = recentEvents.reverse(); // Reverse to maintain chronological order

          // Build atomic context chain
          const atomicContext = await this.atomicConverter.buildAtomicContextChain(
            steps,
            events,
            run,
          );

          // Format for LLM (combines atomic structure with natural language)
          atomicContextMessage = this.atomicConverter.formatAtomicContextForLLM(atomicContext);
        }
      }
    } catch (error) {
      // Fallback to natural language if atomic conversion fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      this.logger.warn(
        `Failed to build atomic context for agent ${agent.id}, falling back to natural language | Error: ${errorName}: ${errorMessage}`,
        {
          agent_id: agent.id,
          run_id: context.runId,
          step_id: context.stepId,
          error_details: {
            name: errorName,
            message: errorMessage,
            ...(error instanceof Error && error.stack && { stack: error.stack }),
          },
        },
      );
    }

    // Retrieve relevant memories for context
    let relevantMemories: any[] = [];
    try {
      // Search for memories related to the current run/agent/tenant
      const memoryQueries: Promise<any[]>[] = [];
      
      // Search by run context
      if (context.runId) {
        memoryQueries.push(
          this.memoryService.searchMemory({
            query: typeof input === 'string' ? input : JSON.stringify(input || {}),
            owner_type: 'run',
            owner_id: context.runId,
            limit: 5,
            threshold: 0.7,
          }),
        );
      }

      // Search by agent context
      if (agent.id) {
        memoryQueries.push(
          this.memoryService.searchMemory({
            query: agent.instructions || agent.name || 'agent context',
            owner_type: 'agent',
            owner_id: agent.id,
            limit: 5,
            threshold: 0.7,
          }),
        );
      }

      // Search by tenant context (if available)
      if (context.tenantId) {
        memoryQueries.push(
          this.memoryService.searchMemory({
            query: typeof input === 'string' ? input : JSON.stringify(input || {}),
            owner_type: 'tenant',
            owner_id: context.tenantId,
            limit: 3,
            threshold: 0.7,
          }),
        );
      }

      if (memoryQueries.length > 0) {
        const memoryResults = await Promise.all(memoryQueries);
        // Flatten and deduplicate by memory_id, then sort by similarity
        const memoryMap = new Map<string, any>();
        for (const result of memoryResults) {
          if (Array.isArray(result)) {
            for (const memory of result) {
              if (!memoryMap.has(memory.memory_id)) {
                memoryMap.set(memory.memory_id, memory);
              } else {
                // Keep the one with higher similarity
                const existing = memoryMap.get(memory.memory_id);
                if (memory.similarity > existing.similarity) {
                  memoryMap.set(memory.memory_id, memory);
                }
              }
            }
          }
        }
        relevantMemories = Array.from(memoryMap.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 10); // Limit to top 10
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      this.logger.warn(
        `Failed to retrieve memories for agent context | Agent: ${agent.id} | Error: ${errorName}: ${errorMessage}`,
        {
          agent_id: agent.id,
          run_id: context.runId,
          step_id: context.stepId,
          error_details: {
            name: errorName,
            message: errorMessage,
            ...(error instanceof Error && error.stack && { stack: error.stack }),
          },
        },
      );
    }

    // Refract input text to JSON✯Atomic format (if it's a string)
    // This structures natural language for better LLM understanding
    let refractedInput: any = input;
    if (typeof input === 'string' && input.trim().length > 0) {
      try {
        const atomicInput = await this.tdlnTService.refractToAtomic(input);
        // Add refracted version alongside original
        refractedInput = {
          original: input,
          refracted: atomicInput,
          // LLM sees both: original for context, refracted for structure
        };
      } catch (error) {
        // If refraction fails, use original input
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        
        this.logger.warn(
          `Failed to refract input for agent ${agent.id}, using original input | Error: ${errorName}: ${errorMessage}`,
          {
            agent_id: agent.id,
            run_id: context.runId,
            step_id: context.stepId,
            input_preview: typeof input === 'string' ? input.substring(0, 100) : '[non-string]',
            error_details: {
              name: errorName,
              message: errorMessage,
              ...(error instanceof Error && error.stack && { stack: error.stack }),
            },
          },
        );
      }
    }

    // Build conversational context (natural language summary)
    const naturalLanguageContext = this.contextSummarizer.buildConversationalContext(
      context.previousSteps || [],
      context.workflowInput,
      typeof input === 'string' ? input : undefined,
    );

    // Combine atomic format (structured) with natural language (dignified)
    const combinedContext = atomicContextMessage
      ? `${atomicContextMessage}\n\nNatural Language Summary:\n${naturalLanguageContext}`
      : naturalLanguageContext;

    if (combinedContext) {
      messages.push({
        role: 'user',
        content: combinedContext,
      });
    }

    // Add relevant memories to context if available
    if (relevantMemories.length > 0) {
      const memoryContext = `Relevant memories from previous interactions:

${relevantMemories
  .map(
    (m, idx) => {
      const content = m.content || '';
      const type = m.type || 'unknown';
      const similarity = typeof m.similarity === 'number' ? m.similarity : parseFloat(m.similarity || '0');
      return `${idx + 1}. [${type}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''} (similarity: ${(similarity * 100).toFixed(1)}%)`;
    },
  )
  .join('\n')}

These memories may help inform your decisions and responses.`;

      messages.push({
        role: 'user',
        content: memoryContext,
      });
    }

    // Add current input - if refracted, show both original and structured format
    if (refractedInput && typeof refractedInput === 'object' && refractedInput.refracted) {
      // Input was refracted to JSON✯Atomic
      messages.push({
        role: 'user',
        content: `Current input (structured format for better understanding):

Original text: "${refractedInput.original}"

Refracted to JSON✯Atomic:
${JSON.stringify(refractedInput.refracted, null, 2)}

This structured format helps you understand:
- Semantic components (F_KEY, F_NET, F_CODE, etc.)
- Clear structure instead of raw text
- Better context for decision-making`,
      });
    } else if (input && typeof input !== 'string') {
      const inputSummary = this.contextSummarizer.summarizeWorkflowInput(input);
      messages.push({
        role: 'user',
        content: inputSummary,
      });
    } else if (input && typeof input === 'string' && !combinedContext.includes(input)) {
      messages.push({
        role: 'user',
        content: input,
      });
    }

    return messages;
  }

  /**
   * Enhance instructions to be more dignified and clear
   */
  private enhanceInstructions(instructions: string): string {
    // If instructions are already well-written, return as-is
    // Otherwise, wrap with helpful context
    
    // Check if instructions are too restrictive or command-like
    const restrictivePatterns = [
      /ONLY/i,
      /Do not/i,
      /Never/i,
      /Must not/i,
      /You must/i,
    ];

    const isRestrictive = restrictivePatterns.some(pattern => pattern.test(instructions));

    if (!isRestrictive) {
      // Instructions are already good
      return instructions;
    }

    // Add helpful context while preserving original intent
    return `${instructions}

Remember: You're working in a collaborative environment. If you need clarification or notice any issues, feel free to mention them. We're here to work together to get the best results.`;
  }

  /**
   * Convert JSON Schema to Zod schema (recursive version supporting nested objects and arrays)
   */
  private jsonSchemaToZod(schema: Record<string, any>): z.ZodTypeAny {
    if (!schema || typeof schema !== 'object') {
      return z.any();
    }

    // Handle array schemas
    if (schema.type === 'array') {
      if (schema.items) {
        const itemSchema = this.jsonSchemaToZod(schema.items);
        return z.array(itemSchema);
      }
      return z.array(z.any());
    }

    // Handle object schemas
    if (schema.type === 'object' || schema.properties) {
      if (!schema.properties) {
        return z.object({});
      }

      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, prop] of Object.entries(schema.properties)) {
        const propSchema = prop as any;
        let zodType: z.ZodTypeAny;

        // Recursively handle nested objects
        if (propSchema.type === 'object' || propSchema.properties) {
          zodType = this.jsonSchemaToZod(propSchema);
        }
        // Handle arrays with item schemas
        else if (propSchema.type === 'array') {
          if (propSchema.items) {
            const itemSchema = this.jsonSchemaToZod(propSchema.items);
            zodType = z.array(itemSchema);
          } else {
            zodType = z.array(z.any());
          }
        }
        // Handle primitive types
        else {
          switch (propSchema.type) {
            case 'string':
              if (propSchema.enum) {
                zodType = z.enum(propSchema.enum as [string, ...string[]]);
              } else {
                let stringType = z.string();
                if (propSchema.minLength !== undefined) {
                  stringType = stringType.min(propSchema.minLength);
                }
                if (propSchema.maxLength !== undefined) {
                  stringType = stringType.max(propSchema.maxLength);
                }
                zodType = stringType;
              }
              break;
            case 'number':
            case 'integer':
              let numberType = z.number();
              if (propSchema.minimum !== undefined) {
                numberType = numberType.min(propSchema.minimum);
              }
              if (propSchema.maximum !== undefined) {
                numberType = numberType.max(propSchema.maximum);
              }
              zodType = numberType;
              break;
            case 'boolean':
              zodType = z.boolean();
              break;
            default:
              zodType = z.any();
          }
        }

        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }

        // Check if field is required
        const isRequired = schema.required?.includes(key) ?? false;
        if (isRequired) {
          shape[key] = zodType;
        } else {
          shape[key] = zodType.optional();
        }
      }

      return z.object(shape);
    }

    // Handle primitive types at root level
    switch (schema.type) {
      case 'string':
        return z.string();
      case 'number':
      case 'integer':
        return z.number();
      case 'boolean':
        return z.boolean();
      default:
        return z.any();
    }
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agentRepository.findOne({ where: { id: agentId } });
  }
}
