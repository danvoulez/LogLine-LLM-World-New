import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { NaturalLanguageDbTool } from './natural-language-db.tool';

export interface ToolContext {
  runId: string;
  stepId: string;
  appId?: string;
  userId?: string;
  tenantId: string;
}

export type ToolHandler = (input: any, ctx: ToolContext) => Promise<any>;

@Injectable()
export class ToolRuntimeService {
  private toolHandlers: Map<string, ToolHandler> = new Map();

  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private naturalLanguageDbTool: NaturalLanguageDbTool,
  ) {
    this.registerBuiltinTools();
  }

  private registerBuiltinTools() {
    // Register natural language DB tools
    this.toolHandlers.set('natural_language_db_read', async (input, ctx) => {
      const tool = await this.naturalLanguageDbTool.createReadTool();
      return tool.execute(input, ctx);
    });

    this.toolHandlers.set('natural_language_db_write', async (input, ctx) => {
      const tool = await this.naturalLanguageDbTool.createWriteTool();
      return tool.execute(input, ctx);
    });

    // Example: ticketing tool (placeholder)
    this.toolHandlers.set('ticketing.list_open', async (input, ctx) => {
      // TODO: Real integration later
      return {
        tickets: [
          { id: 'T-1', subject: 'No hot water', status: 'open' },
          { id: 'T-2', subject: 'Late check-in', status: 'open' },
        ],
      };
    });
  }

  async callTool(
    toolId: string,
    input: any,
    context: ToolContext,
  ): Promise<any> {
    // Load tool from database
    const tool = await this.toolRepository.findOne({
      where: { id: toolId },
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${toolId} not found`);
    }

    // TODO: Policy check (Phase 4)
    // const allowed = await this.policyEngine.checkToolCall(toolId, context);
    // if (!allowed) {
    //   throw new Error(`Policy denied: Tool ${toolId} not allowed`);
    // }

    // TODO: Input validation using tool.input_schema
    // const validated = await validateInput(input, tool.input_schema);

    // Get handler
    const handler = this.toolHandlers.get(toolId);
    if (!handler) {
      throw new Error(`No handler registered for tool: ${toolId}`);
    }

    // Execute tool
    let output: any;
    try {
      output = await handler(input, context);
    } catch (error) {
      // Log error event
      await this.eventRepository.save({
        run_id: context.runId,
        step_id: context.stepId,
        kind: EventKind.TOOL_CALL,
        payload: {
          tool_id: toolId,
          input,
          error: error.message,
        },
      });
      throw error;
    }

    // Log tool call event
    await this.eventRepository.save({
      run_id: context.runId,
      step_id: context.stepId,
      kind: EventKind.TOOL_CALL,
      payload: {
        tool_id: toolId,
        input,
        output,
      },
    });

    return output;
  }

  registerTool(toolId: string, handler: ToolHandler) {
    this.toolHandlers.set(toolId, handler);
  }

  async getTool(toolId: string): Promise<Tool | null> {
    return this.toolRepository.findOne({ where: { id: toolId } });
  }

  async getAllTools(): Promise<Tool[]> {
    return this.toolRepository.find();
  }
}

