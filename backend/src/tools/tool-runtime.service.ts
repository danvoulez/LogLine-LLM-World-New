import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { NaturalLanguageDbTool } from './natural-language-db.tool';
import { ToolNotFoundException } from '../common/exceptions/tool-not-found.exception';
import { ToolExecutionException } from '../common/exceptions/tool-execution.exception';
import { ValidationException } from '../common/exceptions/validation.exception';
import { ScopeDeniedException } from '../common/exceptions/scope-denied.exception';
import { SchemaValidatorService } from '../common/validators/schema-validator.service';
import { AppScopeCheckerService } from '../apps/services/app-scope-checker.service';
import { PolicyEngineV0Service } from '../policies/policy-engine-v0.service';
import { PolicyEngineV1Service } from '../policies/policy-engine-v1.service';
import { RetryUtil } from '../common/utils/retry.util';
import { sanitizeForLogging } from '../common/utils/sanitize.util';
import { MemoryTool } from './memory.tool';

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
    private memoryTool: MemoryTool,
    private schemaValidator: SchemaValidatorService,
    private scopeChecker: AppScopeCheckerService,
    private policyEngineV0: PolicyEngineV0Service,
    private policyEngineV1: PolicyEngineV1Service,
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

    // Register memory tools
    const memoryTools = this.memoryTool.getAllTools();
    for (const tool of memoryTools) {
      this.toolHandlers.set(tool.id, async (input, ctx) => {
        return tool.handler(input, ctx);
      });
    }
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

    // Sanitize input before logging to prevent PII leakage
    const sanitizedInput = sanitizeForLogging(input);
    this.logger.log(`Calling tool: ${toolId}`, {
      ...logContext,
      input: sanitizedInput,
    });

    // Load tool from database
    const tool = await this.toolRepository.findOne({
      where: { id: toolId },
    });

    if (!tool) {
      this.logger.error(`Tool not found: ${toolId}`, undefined, logContext);
      throw new ToolNotFoundException(toolId, logContext);
    }

    // Policy Engine v1 check (BEFORE app scope check)
    try {
      const policyDecision = await this.policyEngineV1.checkToolCall(toolId, {
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
            action: 'tool_call',
            tool_id: toolId,
            app_id: context.appId,
            user_id: context.userId,
            tenant_id: context.tenantId,
            result: 'denied',
            reason: policyDecision.reason || 'Policy denied tool call',
          },
        });

        this.logger.warn(
          `Policy denied tool call: ${toolId}`,
          undefined,
          { ...logContext, reason: policyDecision.reason },
        );

        if (policyDecision.requiresApproval) {
          throw new ScopeDeniedException(
            context.appId || 'system',
            'tool',
            toolId,
            logContext,
          );
        }

        throw new ScopeDeniedException(
          context.appId || 'system',
          'tool',
          toolId,
          logContext,
        );
      }

      // Log policy allowance
      await this.eventRepository.save({
        run_id: context.runId,
        step_id: context.stepId,
        kind: EventKind.POLICY_EVAL,
        payload: {
          action: 'tool_call',
          tool_id: toolId,
          app_id: context.appId,
          user_id: context.userId,
          tenant_id: context.tenantId,
          result: 'allowed',
          reason: policyDecision.reason || 'Policy allows tool call',
        },
      });

      // Apply policy modifications if any (e.g., mode override, limits)
      if (policyDecision.modifiedContext) {
        // For now, we log modifications but don't change the execution context
        // Future: could adjust context based on modifications
        this.logger.debug(
          `Policy modified context for tool call: ${toolId}`,
          { ...logContext, modifications: policyDecision.modifiedContext },
        );
      }
    } catch (error) {
      // If policy check throws (e.g., tool/run not found), log and re-throw
      if (error instanceof ScopeDeniedException) {
        throw error;
      }
      this.logger.error(
        `Policy check failed for tool: ${toolId}`,
        error instanceof Error ? error.stack : String(error),
        logContext,
      );
      // Don't block execution if policy check fails (fail open for now)
      // In production, you might want to fail closed
    }

    // Check app scope (if app context is provided)
    if (context.appId) {
      const hasScope = await this.scopeChecker.checkToolScope(
        context.appId,
        toolId,
      );

      if (!hasScope) {
        // Log scope check as event
        await this.eventRepository.save({
          run_id: context.runId,
          step_id: context.stepId,
          kind: EventKind.POLICY_EVAL,
          payload: {
            action: 'tool_call',
            tool_id: toolId,
            app_id: context.appId,
            result: 'denied',
            reason: 'scope_not_granted',
          },
        });

        this.logger.error(
          `Scope denied: app=${context.appId}, tool=${toolId}`,
          undefined,
          logContext,
        );
        throw new ScopeDeniedException(
          context.appId,
          'tool',
          toolId,
          logContext,
        );
      }

      // Log successful scope check
      await this.eventRepository.save({
        run_id: context.runId,
        step_id: context.stepId,
        kind: EventKind.POLICY_EVAL,
        payload: {
          action: 'tool_call',
          tool_id: toolId,
          app_id: context.appId,
          result: 'allowed',
          reason: 'scope_granted',
        },
      });
    }

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

    // Log successful tool call event (include query_classification if present)
    const eventPayload: any = {
      tool_id: toolId,
      input: validatedInput,
      output,
      context: logContext,
    };

    // Add query_classification for natural language DB tools
    if (toolId === 'natural_language_db_read' && output?.query_classification) {
      eventPayload.query_classification = output.query_classification;
    }

    await this.eventRepository.save({
      run_id: context.runId,
      step_id: context.stepId,
      kind: EventKind.TOOL_CALL,
      payload: eventPayload,
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

