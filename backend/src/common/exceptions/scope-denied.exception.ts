import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when an app tries to use a resource (tool, memory, external)
 * that is not in its scopes.
 */
export class ScopeDeniedException extends HttpException {
  constructor(
    public readonly appId: string | undefined,
    public readonly scopeType: 'tool' | 'memory' | 'external' | 'agent',
    public readonly scopeValue: string,
    context?: Record<string, any>,
  ) {
    const message = appId
      ? `Scope denied: App '${appId}' does not have permission to use ${scopeType} '${scopeValue}'`
      : `Scope denied: ${scopeType} '${scopeValue}' requires app context`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'SCOPE_DENIED',
        message,
        app_id: appId,
        scope_type: scopeType,
        scope_value: scopeValue,
        ...context,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

