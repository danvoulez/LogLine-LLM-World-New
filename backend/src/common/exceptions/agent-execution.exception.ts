import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when agent execution fails
 * Provides verbose error information including agent context, LLM details, and execution state
 */
export class AgentExecutionException extends BaseException {
  constructor(
    agentId: string,
    message: string,
    originalError?: Error,
    context?: Record<string, any>,
  ) {
    // Build detailed error message (before super call)
    const detailedMessage = AgentExecutionException.buildDetailedMessageStatic(agentId, message, context, originalError);

    super(
      detailedMessage,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'AGENT_EXECUTION_ERROR',
      {
        agent_id: agentId,
        agent_name: context?.agent_name || agentId,
        execution_context: {
          run_id: context?.runId || context?.run_id,
          step_id: context?.stepId || context?.step_id,
          workflow_id: context?.workflow_id,
          app_id: context?.appId || context?.app_id,
          tenant_id: context?.tenantId || context?.tenant_id,
          user_id: context?.userId || context?.user_id,
        },
        llm_context: context?.llm_config
          ? {
              provider: context.llm_config.provider,
              model: context.llm_config.model,
              temperature: context.llm_config.temperature,
            }
          : undefined,
        budget_info: context?.budget_exceeded
          ? {
              exceeded: true,
              reason: context.budget_reason,
              cost_cents: context.cost_cents,
              llm_calls: context.llm_calls,
            }
          : undefined,
        tool_calls_count: context?.tool_calls_count,
        ...context,
      },
      originalError,
    );
  }

  /**
   * Build detailed error message with context (static method)
   */
  private static buildDetailedMessageStatic(
    agentId: string,
    message: string,
    context?: Record<string, any>,
    originalError?: Error,
  ): string {
    let detailed = `Agent execution failed for '${agentId}': ${message}`;

    // Add LLM context if available
    if (context?.llm_config) {
      detailed += ` | Model: ${context.llm_config.provider}/${context.llm_config.model}`;
    }

    // Add budget information if exceeded
    if (context?.budget_exceeded) {
      detailed += ` | Budget exceeded: ${context.budget_reason || 'unknown'}`;
    }

    // Add tool calls information
    if (context?.tool_calls_count !== undefined) {
      detailed += ` | Tool calls: ${context.tool_calls_count}`;
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
}

