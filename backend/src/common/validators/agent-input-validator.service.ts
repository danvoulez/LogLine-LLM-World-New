import { Injectable } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';

/**
 * Service for validating agent inputs and context
 */
@Injectable()
export class AgentInputValidatorService {
  /**
   * Validate agent ID format
   */
  validateAgentId(agentId: string): void {
    if (!agentId || typeof agentId !== 'string') {
      throw new ValidationException('Agent ID must be a non-empty string', [], {
        agent_id: agentId,
      });
    }

    // Basic format validation (can be enhanced)
    if (agentId.trim().length === 0) {
      throw new ValidationException('Agent ID cannot be empty', [], {
        agent_id: agentId,
      });
    }

    // Check for valid format (alphanumeric, dots, underscores, hyphens)
    const validFormat = /^[a-zA-Z0-9._-]+$/.test(agentId);
    if (!validFormat) {
      throw new ValidationException(
        'Agent ID must contain only alphanumeric characters, dots, underscores, or hyphens',
        [],
        { agent_id: agentId },
      );
    }
  }

  /**
   * Validate agent context structure
   */
  validateAgentContext(context: {
    runId?: string;
    stepId?: string;
    tenantId?: string;
    userId?: string;
    appId?: string;
  }): void {
    const errors: Array<{ path: string; message: string }> = [];

    if (!context.tenantId || typeof context.tenantId !== 'string') {
      errors.push({
        path: 'tenantId',
        message: 'tenantId is required and must be a string',
      });
    }

    if (context.runId && typeof context.runId !== 'string') {
      errors.push({
        path: 'runId',
        message: 'runId must be a string if provided',
      });
    }

    if (context.stepId && typeof context.stepId !== 'string') {
      errors.push({
        path: 'stepId',
        message: 'stepId must be a string if provided',
      });
    }

    if (context.userId && typeof context.userId !== 'string') {
      errors.push({
        path: 'userId',
        message: 'userId must be a string if provided',
      });
    }

    if (context.appId && typeof context.appId !== 'string') {
      errors.push({
        path: 'appId',
        message: 'appId must be a string if provided',
      });
    }

    if (errors.length > 0) {
      throw new ValidationException('Agent context validation failed', errors, context);
    }
  }

  /**
   * Validate tool IDs array
   */
  validateToolIds(toolIds: string[]): void {
    if (!Array.isArray(toolIds)) {
      throw new ValidationException(
        'Tool IDs must be an array',
        [],
        { tool_ids: toolIds },
      );
    }

    const errors: Array<{ path: string; message: string }> = [];

    toolIds.forEach((toolId, index) => {
      if (typeof toolId !== 'string') {
        errors.push({
          path: `toolIds[${index}]`,
          message: 'Each tool ID must be a string',
        });
      } else if (toolId.trim().length === 0) {
        errors.push({
          path: `toolIds[${index}]`,
          message: 'Tool ID cannot be empty',
        });
      }
    });

    if (errors.length > 0) {
      throw new ValidationException('Tool IDs validation failed', errors, {
        tool_ids: toolIds,
      });
    }
  }
}

