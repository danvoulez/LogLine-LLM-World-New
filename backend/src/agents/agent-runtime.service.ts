import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
  ) {}

  async runAgentStep(
    agentId: string,
    context: AgentContext,
    input?: any,
  ): Promise<AgentResult> {
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
        this.logger.warn(`Deterministic task handling failed, falling back to LLM: ${error.message}`);
      }
    }

    // Load agent from database
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
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
    const messages = await this.buildPrompt(agent, context, input);

    // Get LLM config from agent
    const llmConfig: LlmConfig = {
      provider: agent.model_profile.provider,
      model: agent.model_profile.model,
      temperature: agent.model_profile.temperature,
      maxTokens: agent.model_profile.max_tokens,
    };

    // Generate with tool calling
    const result = await this.llmRouter.generateText(messages, llmConfig, aiTools);

    // Log LLM call as event
    await this.eventRepository.save({
      run_id: context.runId,
      step_id: context.stepId,
      kind: EventKind.LLM_CALL,
      payload: {
        agent_id: agentId,
        model: llmConfig.model,
        provider: llmConfig.provider,
        prompt: messages,
        response: result.text,
        finishReason: result.finishReason,
      },
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
          
          toolCalls.push({
            toolId: toolName,
            toolName: toolName,
            args: args,
            result: { error: error.message },
          });
        }
      }
    }

    return {
      text: result.text,
      toolCalls,
      finishReason: result.finishReason,
    };
  }


  private async buildPrompt(
    agent: Agent,
    context: AgentContext,
    input?: any,
  ): Promise<CoreMessage[]> {
    const messages: CoreMessage[] = [];

    // System message from agent instructions - add dignity and clarity
    if (agent.instructions) {
      const enhancedInstructions = this.enhanceInstructions(agent.instructions);
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
          const steps = await this.stepRepository.find({
            where: { run_id: context.runId },
            order: { started_at: 'ASC' },
            take: 20, // Limit to recent steps
          });

          const events = await this.eventRepository.find({
            where: { run_id: context.runId },
            order: { ts: 'ASC' },
            take: 50, // Limit to recent events
          });

          // Build atomic context chain
          const atomicContext = this.atomicConverter.buildAtomicContextChain(
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
      console.warn('Failed to build atomic context, falling back to natural language:', error);
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

    // Add current input (if not already included in context)
    if (input && typeof input !== 'string') {
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

  private jsonSchemaToZod(schema: Record<string, any>): z.ZodObject<any> {
    // Simple conversion from JSON Schema to Zod
    // This is a basic implementation - can be enhanced
    const shape: Record<string, z.ZodTypeAny> = {};

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const propSchema = prop as any;
        let zodType: z.ZodTypeAny;

        switch (propSchema.type) {
          case 'string':
            zodType = z.string();
            break;
          case 'number':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'array':
            zodType = z.array(z.any());
            break;
          case 'object':
            zodType = z.object({});
            break;
          default:
            zodType = z.any();
        }

        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }

        shape[key] = propSchema.required
          ? zodType
          : zodType.optional();
      }
    }

    return z.object(shape);
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agentRepository.findOne({ where: { id: agentId } });
  }
}

