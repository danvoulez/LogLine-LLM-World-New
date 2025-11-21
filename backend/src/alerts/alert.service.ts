import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual, IsNull } from 'typeorm';
import { AlertConfig, AlertRuleType, AlertThreshold } from './entities/alert-config.entity';
import { AlertHistory } from './entities/alert-history.entity';
import { MetricsService } from '../metrics/metrics.service';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(AlertConfig)
    private alertConfigRepository: Repository<AlertConfig>,
    @InjectRepository(AlertHistory)
    private alertHistoryRepository: Repository<AlertHistory>,
    private metricsService: MetricsService,
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  /**
   * Check all enabled alert rules and trigger alerts if thresholds are exceeded
   */
  async checkAlerts(tenantId?: string): Promise<void> {
    const configs = await this.alertConfigRepository.find({
      where: {
        enabled: true,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
    });

    for (const config of configs) {
      try {
        const shouldTrigger = await this.evaluateRule(config, tenantId);
        if (shouldTrigger.triggered) {
          // Check if alert was already triggered recently (avoid spam)
          const recentAlert = await this.alertHistoryRepository.findOne({
            where: {
              alert_config_id: config.id,
              resolved_at: IsNull(), // Not resolved yet
            },
            order: { triggered_at: 'DESC' },
          });

          // Only trigger if no recent alert or last alert was more than 1 hour ago
          if (
            !recentAlert ||
            new Date().getTime() - new Date(recentAlert.triggered_at).getTime() > 3600000
          ) {
            await this.triggerAlert(config, shouldTrigger.value, shouldTrigger.message);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to evaluate alert rule ${config.id}: ${error.message}`, error.stack);
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(
    config: AlertConfig,
    tenantId?: string,
  ): Promise<{ triggered: boolean; value: any; message?: string }> {
    const threshold = config.threshold;
    const windowMinutes = threshold.window_minutes || 5;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    switch (config.rule_type) {
      case 'error_rate':
        return this.evaluateErrorRate(threshold, windowStart, tenantId);

      case 'budget_exceeded':
        return this.evaluateBudgetExceeded(threshold, windowStart, tenantId);

      case 'policy_denials':
        return this.evaluatePolicyDenials(threshold, windowStart, tenantId);

      case 'memory_usage':
        return this.evaluateMemoryUsage(threshold, tenantId);

      case 'rate_limit':
        return this.evaluateRateLimit(threshold, windowStart, tenantId);

      default:
        this.logger.warn(`Unknown alert rule type: ${config.rule_type}`);
        return { triggered: false, value: null };
    }
  }

  /**
   * Evaluate error rate alert
   */
  private async evaluateErrorRate(
    threshold: AlertThreshold,
    windowStart: Date,
    tenantId?: string,
  ): Promise<{ triggered: boolean; value: any; message?: string }> {
    const totalRuns = await this.runRepository.count({
      where: {
        created_at: MoreThanOrEqual(windowStart),
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
    });

    const failedRuns = await this.runRepository.count({
      where: {
        created_at: MoreThanOrEqual(windowStart),
        status: RunStatus.FAILED,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
    });

    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
    const triggered = this.compareValue(errorRate, threshold);

    return {
      triggered,
      value: { error_rate: errorRate, total_runs: totalRuns, failed_runs: failedRuns },
      message: triggered
        ? `Error rate ${errorRate.toFixed(2)}% exceeds threshold (${threshold.value}%)`
        : undefined,
    };
  }

  /**
   * Evaluate budget exceeded alert
   */
  private async evaluateBudgetExceeded(
    threshold: AlertThreshold,
    windowStart: Date,
    tenantId?: string,
  ): Promise<{ triggered: boolean; value: any; message?: string }> {
    const metrics = await this.metricsService.getMetricsSnapshot(tenantId);
    const costToday = metrics.llm.cost_cents_today;
    const triggered = this.compareValue(costToday, threshold);

    return {
      triggered,
      value: { cost_cents_today: costToday },
      message: triggered
        ? `Daily cost ${costToday} cents exceeds threshold (${threshold.value} cents)`
        : undefined,
    };
  }

  /**
   * Evaluate policy denials alert
   */
  private async evaluatePolicyDenials(
    threshold: AlertThreshold,
    windowStart: Date,
    tenantId?: string,
  ): Promise<{ triggered: boolean; value: any; message?: string }> {
    const metrics = await this.metricsService.getMetricsSnapshot(tenantId);
    const denialsToday = metrics.policies.denials_today;
    const triggered = this.compareValue(denialsToday, threshold);

    return {
      triggered,
      value: { denials_today: denialsToday },
      message: triggered
        ? `Policy denials today (${denialsToday}) exceeds threshold (${threshold.value})`
        : undefined,
    };
  }

  /**
   * Evaluate memory usage alert
   */
  private async evaluateMemoryUsage(
    threshold: AlertThreshold,
    tenantId?: string,
  ): Promise<{ triggered: boolean; value: any; message?: string }> {
    const metrics = await this.metricsService.getMetricsSnapshot(tenantId);
    const memoryItems = metrics.memory.items_total;
    const triggered = this.compareValue(memoryItems, threshold);

    return {
      triggered,
      value: { items_total: memoryItems },
      message: triggered
        ? `Memory items (${memoryItems}) exceeds threshold (${threshold.value})`
        : undefined,
    };
  }

  /**
   * Evaluate rate limit alert
   */
  private async evaluateRateLimit(
    threshold: AlertThreshold,
    windowStart: Date,
    tenantId?: string,
  ): Promise<{ triggered: boolean; value: any; message?: string }> {
    // This would need integration with rate limiting service
    // For now, return not triggered
    return { triggered: false, value: { rate_limit_usage: 0 } };
  }

  /**
   * Compare value against threshold
   */
  private compareValue(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.value;
      case 'lt':
        return value < threshold.value;
      case 'eq':
        return value === threshold.value;
      case 'gte':
        return value >= threshold.value;
      case 'lte':
        return value <= threshold.value;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert (send notifications and log)
   */
  private async triggerAlert(
    config: AlertConfig,
    value: any,
    message?: string,
  ): Promise<void> {
    // Log alert history
    const alertHistory = this.alertHistoryRepository.create({
      alert_config_id: config.id,
      value,
      message,
      tenant_id: config.tenant_id,
    });
    await this.alertHistoryRepository.save(alertHistory);

    // Send notifications via configured channels
    for (const channel of config.channels) {
      try {
        await this.sendNotification(channel, {
          alert_name: config.name,
          rule_type: config.rule_type,
          message: message || `Alert "${config.name}" triggered`,
          value,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to send alert notification via ${channel.type}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.warn(`Alert triggered: ${config.name} - ${message}`);
  }

  /**
   * Send notification via channel
   */
  private async sendNotification(
    channel: { type: string; config: any },
    payload: Record<string, any>,
  ): Promise<void> {
    switch (channel.type) {
      case 'webhook':
        if (channel.config.url) {
          await fetch(channel.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
        break;

      case 'email':
        // Email sending would require integration with SendGrid/Resend
        this.logger.log(`Email alert (not implemented): ${channel.config.email} - ${payload.message}`);
        break;

      case 'slack':
        if (channel.config.url) {
          await fetch(channel.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: payload.message,
              attachments: [
                {
                  color: 'danger',
                  fields: [
                    { title: 'Alert Name', value: payload.alert_name, short: true },
                    { title: 'Rule Type', value: payload.rule_type, short: true },
                    { title: 'Value', value: JSON.stringify(payload.value), short: false },
                  ],
                },
              ],
            }),
          });
        }
        break;

      case 'pagerduty':
        // PagerDuty integration would require their API
        this.logger.log(`PagerDuty alert (not implemented): ${payload.message}`);
        break;

      default:
        this.logger.warn(`Unknown notification channel type: ${channel.type}`);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertHistoryId: string): Promise<void> {
    await this.alertHistoryRepository.update(
      { id: alertHistoryId },
      { resolved_at: new Date() },
    );
  }

  /**
   * Cleanup old alert history (older than 90 days)
   */
  async cleanupOldAlerts(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    await this.alertHistoryRepository.delete({
      triggered_at: LessThan(cutoffDate),
    });
  }
}

