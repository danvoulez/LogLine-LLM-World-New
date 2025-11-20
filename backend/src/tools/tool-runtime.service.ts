import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { NaturalLanguageDbTool } from './natural-language-db.tool';
import { ToolNotFoundException } from '../common/exceptions/tool-not-found.exception';
import { ToolExecutionException } from '../common/exceptions/tool-execution.exception';
import { ValidationException } from '../common/exceptions/validation.exception';
import { SchemaValidatorService } from '../common/validators/schema-validator.service';
import { RetryUtil } from '../common/utils/retry.util';

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
  private readonly logger = new Logger(ToolRuntimeService.name);
  private toolHandlers: Map<string, ToolHandler> = new Map();

  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private naturalLanguageDbTool: NaturalLanguageDbTool,
    private schemaValidator: SchemaValidatorService,
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
    const logContext = {
      tool_id: toolId,
      run_id: context.runId,
      step_id: context.stepId,
      user_id: context.userId,
      tenant_id: context.tenantId,
    };

    this.logger.log(`Calling tool: ${toolId}`, logContext);

    // Load tool from database
    const tool = await this.toolRepository.findOne({
      where: { id: toolId },
    });

    if (!tool) {
      this.logger.error(`Tool not found: ${toolId}`, undefined, logContext);
      throw new ToolNotFoundException(toolId, logContext);
    }

    // TODO: Policy check (Phase 4)
    // const allowed = await this.policyEngine.checkToolCall(toolId, context);
    // if (!allowed) {
    //   throw new Error(`Policy denied: Tool ${toolId} not allowed`);
    // }

    // Input validation using tool.input_schema
    let validatedInput = input;
    if (tool.input_schema && typeof tool.input_schema === 'object') {
      try {
        validatedInput = this.schemaValidator.validate(
          tool.input_schema,
          input,
          logContext, // logContext already includes tool_id
        );
        this.logger.debug(`Tool input validated: ${toolId}`, logContext);
      } catch (error) {
        if (error instanceof ValidationException) {
          this.logger.warn(
            `Tool input validation failed: ${toolId}`,
            undefined,
            { ...logContext, validation_errors: error.context?.validation_errors },
          );
          throw error;
        }
        // Re-throw if not a validation error
        throw error;
      }
    }

    // Get handler
    const handler = this.toolHandlers.get(toolId);
    if (!handler) {
      this.logger.error(
        `No handler registered for tool: ${toolId}`,
        undefined,
        logContext,
      );
      throw new ToolExecutionException(
        toolId,
        `No handler registered for tool: ${toolId}`,
        undefined,
        logContext,
      );
    }

    // Execute tool with retry for transient errors
    let output: any;
    try {
      output = await RetryUtil.retryWithBackoff(
        async () => {
          return await handler(validatedInput, context);
        },
        3, // max attempts
        500, // base delay (shorter for tools)
        this.logger,
      );

      this.logger.log(`Tool execution successful: ${toolId}`, logContext);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown tool error';

      // Log error event with enhanced context
      await this.eventRepository.save({
        run_id: context.runId,
        step_id: context.stepId,
        kind: EventKind.ERROR,
        payload: {
          tool_id: toolId,
          input: validatedInput,
          error: errorMessage,
          error_type: error instanceof Error ? error.name : 'Unknown',
          ...(error instanceof Error && error.stack && { stack: error.stack }),
          context: logContext,
        },
      });

      this.logger.error(
        `Tool execution failed: ${toolId}`,
        error instanceof Error ? error.stack : String(error),
        logContext,
      );

      // For non-critical tools, we could return a partial result
      // For now, throw exception
      throw new ToolExecutionException(
        toolId,
        errorMessage,
        error instanceof Error ? error : new Error(String(error)),
        logContext,
      );
    }

    // Log successful tool call event
    await this.eventRepository.save({
      run_id: context.runId,
      step_id: context.stepId,
      kind: EventKind.TOOL_CALL,
      payload: {
        tool_id: toolId,
        input: validatedInput,
        output,
        context: logContext,
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

