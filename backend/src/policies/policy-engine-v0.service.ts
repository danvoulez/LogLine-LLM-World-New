import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from '../tools/entities/tool.entity';
import { Run } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

@Injectable()
export class PolicyEngineV0Service {
  private readonly logger = new Logger(PolicyEngineV0Service.name);

  // Whitelist of apps allowed to use medium-risk tools in auto mode
  // TODO: Move to database/config in Phase 4
  private readonly mediumRiskWhitelist: string[] = [];

  constructor(
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  /**
   * Check if a tool call is allowed based on simple rules
   * 
   * Rules:
   * - high risk + auto mode → deny
   * - medium risk + auto mode → allow only for whitelisted apps
   * - low risk → allow
   * - draft mode → allow (safer for testing)
   */
  async checkToolCall(
    toolId: string,
    context: {
      runId: string;
      appId?: string;
      userId?: string;
      tenantId: string;
    },
  ): Promise<PolicyDecision> {
    // Load tool to get risk_level
    const tool = await this.toolRepository.findOne({ where: { id: toolId } });
    if (!tool) {
      return {
        allowed: false,
        reason: `Tool ${toolId} not found`,
      };
    }

    // Load run to get mode
    const run = await this.runRepository.findOne({ where: { id: context.runId } });
    if (!run) {
      return {
        allowed: false,
        reason: `Run ${context.runId} not found`,
      };
    }

    // Get risk_level from tool (default to 'low' if not set)
    // Note: risk_level is not in current schema, using metadata or default
    const riskLevel = (tool as any).risk_level || (tool as any).metadata?.risk_level || 'low';
    const mode = run.mode;

    // Rule 1: High risk + auto mode → deny
    if (riskLevel === 'high' && mode === 'auto') {
      this.logger.warn(
        `Policy denied: High-risk tool ${toolId} in auto mode`,
        { toolId, runId: context.runId, appId: context.appId, mode },
      );

      await this.logPolicyDecision(context.runId, toolId, false, 'high_risk_auto_mode_denied', context);

      return {
        allowed: false,
        reason: 'High-risk tools are not allowed in auto mode. Use draft mode for testing.',
        requiresApproval: true,
      };
    }

    // Rule 2: Medium risk + auto mode → allow only for whitelisted apps
    if (riskLevel === 'medium' && mode === 'auto') {
      if (!context.appId || !this.mediumRiskWhitelist.includes(context.appId)) {
        this.logger.warn(
          `Policy denied: Medium-risk tool ${toolId} in auto mode without whitelist`,
          { toolId, runId: context.runId, appId: context.appId, mode },
        );

        await this.logPolicyDecision(context.runId, toolId, false, 'medium_risk_auto_mode_not_whitelisted', context);

        return {
          allowed: false,
          reason: 'Medium-risk tools in auto mode require app whitelist approval.',
          requiresApproval: true,
        };
      }
    }

    // Rule 3: Low risk → allow
    // Rule 4: Draft mode → allow (safer for testing)
    await this.logPolicyDecision(context.runId, toolId, true, 'allowed', context);

    return {
      allowed: true,
    };
  }

  private async logPolicyDecision(
    runId: string,
    toolId: string,
    allowed: boolean,
    reason: string,
    context: { appId?: string; userId?: string; tenantId: string },
  ): Promise<void> {
    await this.eventRepository.save({
      run_id: runId,
      kind: EventKind.POLICY_EVAL,
      payload: {
        tool_id: toolId,
        allowed,
        reason,
        app_id: context.appId,
        user_id: context.userId,
        tenant_id: context.tenantId,
        policy_engine: 'v0',
      },
    });
  }
}

