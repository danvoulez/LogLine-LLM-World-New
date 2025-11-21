import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseException } from '../exceptions/base.exception';

/**
 * Global exception filter that catches all exceptions and formats consistent error responses
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Extract context from request (run_id, step_id, user_id, tenant_id)
    const traceId = this.extractTraceId(request);
    const context = this.extractContext(request);

    let status: HttpStatus;
    let errorCode: string;
    let message: string;
    let details: any;

    if (exception instanceof BaseException) {
      // Custom exception with structured format
      status = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      details = {
        ...exception.context,
        ...(exception.originalError && {
          original_error: this.sanitizeError(exception.originalError),
        }),
      };
    } else if (exception instanceof HttpException) {
      // NestJS HttpException
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = this.mapStatusToErrorCode(status);
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message || 'An error occurred';
        errorCode = responseObj.errorCode || this.mapStatusToErrorCode(status);
        details = {
          ...(responseObj.errors && { errors: responseObj.errors }),
          ...(responseObj.context && { context: responseObj.context }),
        };
      } else {
        message = exception.message || 'An error occurred';
        errorCode = this.mapStatusToErrorCode(status);
      }
    } else if (exception instanceof Error) {
      // Generic Error
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_SERVER_ERROR';
      message = exception.message || 'An internal server error occurred';
      details = this.sanitizeError(exception);
    } else {
      // Unknown error type
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'UNKNOWN_ERROR';
      message = 'An unknown error occurred';
      details = { original_error: String(exception) };
    }

    // Log error with context
    const logContext = {
      statusCode: status,
      errorCode,
      path: request.url,
      method: request.method,
      traceId,
      ...context,
    };

    // Enhanced error logging with verbose context
    const verboseContext = {
      ...logContext,
      error_details: {
        code: errorCode,
        message,
        ...(exception instanceof Error && {
          name: exception.name,
          ...(process.env.NODE_ENV === 'development' && {
            stack: exception.stack,
          }),
        }),
      },
      request_details: {
        method: request.method,
        url: request.url,
        path: request.path,
        query: request.query,
        body_preview: request.body
          ? JSON.stringify(request.body).substring(0, 500)
          : undefined,
        headers: {
          'user-agent': request.headers['user-agent'],
          'content-type': request.headers['content-type'],
          'authorization': request.headers['authorization']
            ? '[REDACTED]'
            : undefined,
        },
      },
    };

    if (status >= 500) {
      // Server errors - log with stack trace in development
      this.logger.error(
        `${errorCode}: ${message} | Path: ${request.method} ${request.path} | TraceId: ${traceId || 'none'}`,
        process.env.NODE_ENV === 'development' && exception instanceof Error
          ? exception.stack
          : undefined,
        verboseContext,
      );
    } else {
      // Client errors - log as warning with context
      this.logger.warn(
        `${errorCode}: ${message} | Path: ${request.method} ${request.path} | TraceId: ${traceId || 'none'}`,
        verboseContext,
      );
    }

    // Format error response
    const errorResponse = {
      statusCode: status,
      errorCode,
      message,
      ...(details && Object.keys(details).length > 0 && { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(traceId && { traceId }),
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Extract trace ID (run_id) from request headers or body
   */
  private extractTraceId(request: Request): string | undefined {
    return (
      request.headers['x-trace-id'] ||
      request.headers['x-run-id'] ||
      (request.body && request.body.run_id) ||
      undefined
    );
  }

  /**
   * Extract context from request (user_id, tenant_id, step_id, etc.)
   */
  private extractContext(request: Request): Record<string, any> {
    const context: Record<string, any> = {};

    // Extract from headers
    if (request.headers['x-user-id']) {
      context.user_id = request.headers['x-user-id'];
    }
    if (request.headers['x-tenant-id']) {
      context.tenant_id = request.headers['x-tenant-id'];
    }
    if (request.headers['x-step-id']) {
      context.step_id = request.headers['x-step-id'];
    }
    if (request.headers['x-app-id']) {
      context.app_id = request.headers['x-app-id'];
    }

    // Extract from body if available
    if (request.body) {
      if (request.body.user_id) context.user_id = request.body.user_id;
      if (request.body.tenant_id) context.tenant_id = request.body.tenant_id;
      if (request.body.step_id) context.step_id = request.body.step_id;
      if (request.body.app_id) context.app_id = request.body.app_id;
    }

    return context;
  }

  /**
   * Map HTTP status code to error code
   */
  private mapStatusToErrorCode(status: HttpStatus): string {
    const mapping: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
    };

    return mapping[status] || 'UNKNOWN_ERROR';
  }

  /**
   * Sanitize error for production (remove stack traces, sensitive data)
   */
  private sanitizeError(error: Error): any {
    if (process.env.NODE_ENV === 'development') {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Production: only return safe information
    return {
      name: error.name,
      message: error.message,
    };
  }
}

