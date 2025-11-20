import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { Tool } from '../tools/entities/tool.entity';
import { LlmRouterService, LlmConfig } from '../llm/llm-router.service';
import { ToolRuntimeService, ToolContext } from '../tools/tool-runtime.service';
import { Event, EventKind } from '../runs/entities/event.entity';
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
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private llmRouter: LlmRouterService,
    private toolRuntime: ToolRuntimeService,
  ) {}

  async runAgentStep(
    agentId: string,
    context: AgentContext,
    input?: any,
  ): Promise<AgentResult> {
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

    // Build prompt from agent config
    const messages = this.buildPrompt(agent, context, input);

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


  private buildPrompt(
    agent: Agent,
    context: AgentContext,
    input?: any,
  ): CoreMessage[] {
    const messages: CoreMessage[] = [];

    // System message from agent instructions
    if (agent.instructions) {
      messages.push({
        role: 'system',
        content: agent.instructions,
      });
    }

    // Add context from previous steps
    if (context.previousSteps && context.previousSteps.length > 0) {
      messages.push({
        role: 'user',
        content: `Previous steps:\n${JSON.stringify(context.previousSteps, null, 2)}`,
      });
    }

    // Add workflow input
    if (context.workflowInput) {
      messages.push({
        role: 'user',
        content: `Workflow input: ${JSON.stringify(context.workflowInput, null, 2)}`,
      });
    }

    // Add current input
    if (input) {
      messages.push({
        role: 'user',
        content: typeof input === 'string' ? input : JSON.stringify(input, null, 2),
      });
    }

    return messages;
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

