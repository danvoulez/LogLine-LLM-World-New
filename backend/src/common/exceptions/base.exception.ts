import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception class for custom exceptions
 * Provides structured error responses with error codes and verbose context
 */
export abstract class BaseException extends HttpException {
  public readonly errorCode: string;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;
  public readonly timestamp: string;
  public readonly stack?: string;

  constructor(
    message: string,
    statusCode: HttpStatus,
    errorCode: string,
    context?: Record<string, any>,
    originalError?: Error,
  ) {
    // Build enhanced message with context (before super call)
    const timestamp = new Date().toISOString();
    const enrichedContext = BaseException.enrichContextStatic(context, originalError, timestamp);
    const enhancedMessage = BaseException.buildEnhancedMessageStatic(message, context, originalError);

    super(
      {
        statusCode,
        errorCode,
        message: enhancedMessage,
        context: enrichedContext,
        timestamp,
        ...(process.env.NODE_ENV === 'development' && originalError?.stack && {
          stack: originalError.stack,
        }),
      },
      statusCode,
    );
    this.errorCode = errorCode;
    this.context = enrichedContext;
    this.originalError = originalError;
    this.timestamp = timestamp;
    this.stack = originalError?.stack;
  }

  /**
   * Build enhanced error message with context information (static method)
   */
  private static buildEnhancedMessageStatic(
    message: string,
    context?: Record<string, any>,
    originalError?: Error,
  ): string {
    let enhanced = message;

    // Add context hints
    if (context) {
      const contextHints: string[] = [];
      if (context.run_id) contextHints.push(`Run: ${context.run_id}`);
      if (context.step_id) contextHints.push(`Step: ${context.step_id}`);
      if (context.workflow_id) contextHints.push(`Workflow: ${context.workflow_id}`);
      if (context.app_id) contextHints.push(`App: ${context.app_id}`);
      if (context.tenant_id) contextHints.push(`Tenant: ${context.tenant_id}`);
      if (context.user_id) contextHints.push(`User: ${context.user_id}`);

      if (contextHints.length > 0) {
        enhanced += ` [${contextHints.join(', ')}]`;
      }
    }

    // Add original error type if available
    if (originalError) {
      const errorType = originalError.name || 'Error';
      if (errorType !== 'Error') {
        enhanced += ` (${errorType})`;
      }
    }

    return enhanced;
  }

  /**
   * Enrich context with additional debugging information (static method)
   */
  private static enrichContextStatic(
    context?: Record<string, any>,
    originalError?: Error,
    timestamp?: string,
  ): Record<string, any> {
    const enriched: Record<string, any> = {
      ...context,
    };

    if (originalError) {
      enriched.original_error = {
        name: originalError.name,
        message: originalError.message,
        ...(process.env.NODE_ENV === 'development' && {
          stack: originalError.stack,
        }),
      };
    }

    // Add environment info in development
    if (process.env.NODE_ENV === 'development') {
      enriched.environment = {
        node_env: process.env.NODE_ENV,
        timestamp: timestamp || new Date().toISOString(),
      };
    }

    return enriched;
  }

  /**
   * Get verbose error details for logging
   */
  getVerboseDetails(): Record<string, any> {
    return {
      errorCode: this.errorCode,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      ...(this.originalError && {
        originalError: {
          name: this.originalError.name,
          message: this.originalError.message,
          stack: this.originalError.stack,
        },
      }),
    };
  }
}

