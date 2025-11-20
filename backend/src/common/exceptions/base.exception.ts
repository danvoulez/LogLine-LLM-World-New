import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception class for custom exceptions
 * Provides structured error responses with error codes
 */
export abstract class BaseException extends HttpException {
  public readonly errorCode: string;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    statusCode: HttpStatus,
    errorCode: string,
    context?: Record<string, any>,
    originalError?: Error,
  ) {
    super(
      {
        statusCode,
        errorCode,
        message,
        context,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
    this.errorCode = errorCode;
    this.context = context;
    this.originalError = originalError;
  }
}

