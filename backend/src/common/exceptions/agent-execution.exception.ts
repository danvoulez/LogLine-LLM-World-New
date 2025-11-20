import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when agent execution fails
 */
export class AgentExecutionException extends BaseException {
  constructor(
    agentId: string,
    message: string,
    originalError?: Error,
    context?: Record<string, any>,
  ) {
    super(
      `Agent execution failed for '${agentId}': ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'AGENT_EXECUTION_ERROR',
      {
        agent_id: agentId,
        ...context,
      },
      originalError,
    );
  }
}

