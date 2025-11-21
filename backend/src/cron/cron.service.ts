import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertService } from '../alerts/alert.service';
import { AuditCleanupService } from '../audit/audit-cleanup.service';
import { RateLimitService } from '../rate-limiting/rate-limit.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private alertService: AlertService,
    private auditCleanupService: AuditCleanupService,
    private rateLimitService: RateLimitService,
  ) {}

  /**
   * Check alerts every 5 minutes
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async handleAlertCheck() {
    this.logger.log('Running scheduled alert check');
    try {
      await this.alertService.checkAlerts();
    } catch (error) {
      this.logger.error(`Alert check failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Cleanup old audit logs daily at 2 AM
   */
  @Cron('0 2 * * *') // Daily at 2 AM
  async handleAuditCleanup() {
    this.logger.log('Running scheduled audit log cleanup');
    try {
      const result = await this.auditCleanupService.cleanup();
      this.logger.log(`Audit cleanup completed: ${result.deleted} logs deleted`);
    } catch (error) {
      this.logger.error(`Audit cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Cleanup old alert history daily at 3 AM
   */
  @Cron('0 3 * * *') // Daily at 3 AM
  async handleAlertHistoryCleanup() {
    this.logger.log('Running scheduled alert history cleanup');
    try {
      await this.alertService.cleanupOldAlerts();
    } catch (error) {
      this.logger.error(`Alert history cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Cleanup rate limit store every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleRateLimitCleanup() {
    this.logger.log('Running scheduled rate limit cleanup');
    try {
      this.rateLimitService.cleanup();
    } catch (error) {
      this.logger.error(`Rate limit cleanup failed: ${error.message}`, error.stack);
    }
  }
}

