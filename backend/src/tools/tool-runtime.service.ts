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
import { RegistryTool } from '../registry/registry.tool';
import { HttpTool } from './standard/http.tool';
import { GithubTool } from './standard/github.tool';
import { MathTool } from './standard/math.tool';
import { CircuitBreaker } from '../common/utils/circuit-breaker.util';
import * as crypto from 'crypto';

export interface ToolContext {
  runId: string;
  stepId: string;
  appId?: string;
  userId?: string;
  tenantId: string;
}

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  input_schema: Record<string, any>;
  handler: ToolHandler;
  risk_level: 'low' | 'medium' | 'high';
  side_effects: string[];
};

export type ToolHandler = (input: any, ctx: ToolContext) => Promise<any>;

@Injectable()
export class ToolRuntimeService {
  private readonly logger = new Logger(ToolRuntimeService.name);
  private toolHandlers: Map<string, ToolHandler> = new Map();
  // Circuit breaker for executor service (prevents cascading failures)
  private executorCircuitBreaker = new CircuitBreaker(5, 60000, 'executor-service');

  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private naturalLanguageDbTool: NaturalLanguageDbTool,
    private memoryTool: MemoryTool,
    private registryTool: RegistryTool,
    private schemaValidator: SchemaValidatorService,
    private scopeChecker: AppScopeCheckerService,
    private policyEngineV0: PolicyEngineV0Service,
    private policyEngineV1: PolicyEngineV1Service,
    private httpTool: HttpTool,
    private githubTool: GithubTool,
    private mathTool: MathTool,
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

    // Register standard library tools
    this.toolHandlers.set(this.httpTool.getDefinition().id, this.httpTool.handler);
    this.toolHandlers.set(this.githubTool.getDefinition().id, this.githubTool.handler);
    this.toolHandlers.set(this.mathTool.getDefinition().id, this.mathTool.handler);

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

    // Register registry tools
    const registryTools = this.registryTool.getAllTools();
    for (const tool of registryTools) {
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
      
      // CRITICAL SECURITY: Fail-closed by default (configurable via env)
      const failOpen = process.env.POLICY_FAIL_OPEN === 'true';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error(
        `Policy check failed for tool: ${toolId}`,
        error instanceof Error ? error.stack : String(error),
        logContext,
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
            action: 'tool_call',
            tool_id: toolId,
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
          'tool',
          toolId,
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

    // Handle remote execution
    if (tool.handler_type === 'remote' && tool.handler_config) {
      try {
        return await this.callRemoteTool(tool, validatedInput, context);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Remote tool error';
        this.logger.error(`Remote tool execution failed: ${toolId}`, errorMessage, logContext);
        throw new ToolExecutionException(toolId, errorMessage, error as Error, logContext);
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
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Build enhanced error context
      const errorContext = {
        ...logContext,
        tool_name: tool?.name || toolId,
        input_summary: this.summarizeInputForError(validatedInput),
        error_name: errorName,
        error_message: errorMessage,
        timestamp: new Date().toISOString(),
      };

      // Log error event with enhanced context
      await this.eventRepository.save({
        run_id: context.runId,
        step_id: context.stepId,
        kind: EventKind.ERROR,
        payload: {
          tool_id: toolId,
          tool_name: tool?.name || toolId,
          input: validatedInput,
          error: errorMessage,
          error_type: errorName,
          error_name: errorName,
          ...(errorStack && { stack: errorStack }),
          context: errorContext,
          timestamp: new Date().toISOString(),
        },
      });

      // Verbose error logging
      this.logger.error(
        `Tool execution failed: ${toolId} (${tool?.name || 'unknown'}) | Error: ${errorName}: ${errorMessage}`,
        errorStack || String(error),
        {
          ...errorContext,
          error_details: {
            name: errorName,
            message: errorMessage,
            ...(errorStack && { stack: errorStack }),
          },
        },
      );

      // For non-critical tools, we could return a partial result
      // For now, throw exception with enhanced context
      throw new ToolExecutionException(
        toolId,
        errorMessage,
        error instanceof Error ? error : new Error(String(error)),
        {
          ...errorContext,
          tool_name: tool?.name || toolId,
          input: validatedInput,
        },
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

  private async callRemoteTool(tool: Tool, input: any, context: ToolContext): Promise<any> {
    const { url, secret_env } = tool.handler_config;
    if (!url) {
      throw new Error(`Remote tool ${tool.id} missing URL in config`);
    }

    // CRITICAL STABILITY: Use circuit breaker to prevent cascading failures
    return this.executorCircuitBreaker.execute(async () => {
      // Get secret from environment (if configured)
      const secret = secret_env ? process.env[secret_env] : undefined;
      const timestamp = Date.now().toString();
      
      const payload = {
        tool_id: tool.id,
        input,
        context,
      };

      // We send the payload as JSON body
      // The backend logic must match the executor auth middleware
      // Executor expects JSON stringified body to match signature
      const bodyString = JSON.stringify(payload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-LogLine-Tool-Id': tool.id,
        'X-LogLine-Timestamp': timestamp,
      };

      // Sign payload if secret is available
      if (secret) {
        const signature = crypto
          .createHmac('sha256', secret)
          .update(bodyString)
          .digest('hex');
        headers['X-LogLine-Signature'] = signature;
      }

      // CRITICAL STABILITY: Add timeout to prevent hanging requests
      const timeoutMs = 300000; // 5 minutes max for executor operations
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Remote tool execution failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        return result;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error(`Remote tool execution timed out after ${timeoutMs}ms`);
        }
        throw error;
      }
    });
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

  /**
   * Summarize input for error messages (avoid logging sensitive data)
   */
  private summarizeInputForError(input: any): string {
    if (!input) return 'none';

    try {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      
      // Truncate long inputs
      if (inputStr.length > 200) {
        return `${inputStr.substring(0, 200)}... (truncated)`;
      }

      // Mask sensitive fields
      const sensitiveFields = ['password', 'token', 'key', 'secret', 'api_key', 'apikey'];
      let masked = inputStr;
      for (const field of sensitiveFields) {
        const regex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
        masked = masked.replace(regex, `"${field}": "***MASKED***"`);
      }

      return masked;
    } catch {
      return '[unable to serialize input]';
    }
  }
}
