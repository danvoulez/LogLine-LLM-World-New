import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

/**
 * Exception thrown when an agent is not found
 */
export class AgentNotFoundException extends BaseException {
  constructor(agentId: string, context?: Record<string, any>) {
    super(
      `Agent with ID '${agentId}' not found`,
      HttpStatus.NOT_FOUND,
      'AGENT_NOT_FOUND',
      {
        agent_id: agentId,
        ...context,
      },
    );
  }
}

