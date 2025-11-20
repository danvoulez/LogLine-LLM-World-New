import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when workflow definition validation fails
 */
export class WorkflowValidationException extends BaseException {
  constructor(
    message: string,
    validationErrors?: string[] | { errors: Array<{ field: string; message: string; value?: any }> },
    context?: Record<string, any>,
  ) {
    // Handle both old format (string[]) and new format ({ errors: [...] })
    const errors = Array.isArray(validationErrors)
      ? validationErrors
      : validationErrors?.errors?.map((e: any) => `${e.field}: ${e.message}`) || [];

    super(
      `Workflow validation failed: ${message}`,
      HttpStatus.BAD_REQUEST,
      'WORKFLOW_VALIDATION_ERROR',
      {
        validation_errors: errors,
        ...(typeof validationErrors === 'object' && !Array.isArray(validationErrors) ? validationErrors : {}),
        ...context,
      },
    );
  }
}

