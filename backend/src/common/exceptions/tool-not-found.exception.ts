import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when a tool is not found
 */
export class ToolNotFoundException extends BaseException {
  constructor(toolId: string, context?: Record<string, any>) {
    super(
      `Tool with ID '${toolId}' not found`,
      HttpStatus.NOT_FOUND,
      'TOOL_NOT_FOUND',
      {
        tool_id: toolId,
        ...context,
      },
    );
  }
}

