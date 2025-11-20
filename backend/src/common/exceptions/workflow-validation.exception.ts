import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when workflow definition validation fails
 */
export class WorkflowValidationException extends BaseException {
  constructor(
    message: string,
    validationErrors?: string[],
    context?: Record<string, any>,
  ) {
    super(
      `Workflow validation failed: ${message}`,
      HttpStatus.BAD_REQUEST,
      'WORKFLOW_VALIDATION_ERROR',
      {
        validation_errors: validationErrors || [],
        ...context,
      },
    );
  }
}

