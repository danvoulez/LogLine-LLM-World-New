import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when input validation fails
 */
export class ValidationException extends BaseException {
  constructor(
    message: string,
    validationErrors?: Array<{ path: string; message: string }>,
    context?: Record<string, any>,
  ) {
    super(
      `Validation failed: ${message}`,
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      {
        validation_errors: validationErrors || [],
        ...context,
      },
    );
  }
}

