import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when tool execution fails
 */
export class ToolExecutionException extends BaseException {
  constructor(
    toolId: string,
    message: string,
    originalError?: Error,
    context?: Record<string, any>,
  ) {
    super(
      `Tool execution failed for '${toolId}': ${message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'TOOL_EXECUTION_ERROR',
      {
        tool_id: toolId,
        ...context,
      },
      originalError,
    );
  }
}

