import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when tool execution fails
 * Provides verbose error information including tool context, input, and execution details
 */
export class ToolExecutionException extends BaseException {
  constructor(
    toolId: string,
    message: string,
    originalError?: Error,
    context?: Record<string, any>,
  ) {
    // Build detailed error message (before super call)
    const detailedMessage = ToolExecutionException.buildDetailedMessageStatic(toolId, message, context, originalError);

    super(
      detailedMessage,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'TOOL_EXECUTION_ERROR',
      {
        tool_id: toolId,
        tool_name: context?.tool_name || toolId,
        execution_context: {
          run_id: context?.runId || context?.run_id,
          step_id: context?.stepId || context?.step_id,
          workflow_id: context?.workflow_id,
          app_id: context?.appId || context?.app_id,
          tenant_id: context?.tenantId || context?.tenant_id,
          user_id: context?.userId || context?.user_id,
        },
        input_summary: context?.input
          ? ToolExecutionException.summarizeInputStatic(context.input)
          : undefined,
        retry_info: context?.retry_count
          ? {
              attempts: context.retry_count,
              max_attempts: context.max_attempts || 3,
            }
          : undefined,
        ...context,
      },
      originalError,
    );
  }

  /**
   * Build detailed error message with context (static method)
   */
  private static buildDetailedMessageStatic(
    toolId: string,
    message: string,
    context?: Record<string, any>,
    originalError?: Error,
  ): string {
    let detailed = `Tool execution failed for '${toolId}': ${message}`;

    // Add retry information if available
    if (context?.retry_count) {
      detailed += ` (Attempt ${context.retry_count}/${context.max_attempts || 3})`;
    }

    // Add input summary if available
    if (context?.input) {
      const inputSummary = ToolExecutionException.summarizeInputStatic(context.input);
      if (inputSummary) {
        detailed += ` | Input: ${inputSummary}`;
      }
    }

    // Add original error details
    if (originalError) {
      const errorType = originalError.name || 'Error';
      if (errorType !== 'Error') {
        detailed += ` | Error Type: ${errorType}`;
      }
    }

    return detailed;
  }

  /**
   * Summarize input for error messages (avoid logging sensitive data) - static method
   */
  private static summarizeInputStatic(input: any): string {
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

