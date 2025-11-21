import { Injectable, Logger } from '@nestjs/common';
import { AlertService } from '../alerts/alert.service';
import { AuditCleanupService } from '../audit/audit-cleanup.service';
import { RateLimitService } from '../rate-limiting/rate-limit.service';

/**
 * CronService for Vercel Serverless
 * 
 * NOTE: @nestjs/schedule decorators (@Cron) don't work in serverless environments.
 * Instead, these methods are called via HTTP endpoints (CronController) which are
 * triggered by Vercel Cron Jobs configured in vercel.json.
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private alertService: AlertService,
    private auditCleanupService: AuditCleanupService,
    private rateLimitService: RateLimitService,
  ) {}

  /**
   * Check alerts (called via POST /cron/check-alerts)
   * Schedule: Every 5 minutes (configured in vercel.json)
   */
  async handleAlertCheck() {
    this.logger.log('Running scheduled alert check');
    try {
      await this.alertService.checkAlerts();
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack;
      this.logger.error(`Alert check failed: ${errorMessage}`, errorStack);
      throw error; // Re-throw so controller can handle
    }
  }

  /**
   * Cleanup old audit logs (called via POST /cron/cleanup-audit)
   * Schedule: Daily at 2 AM (configured in vercel.json)
   */
  async handleAuditCleanup() {
    this.logger.log('Running scheduled audit log cleanup');
    try {
      const result = await this.auditCleanupService.cleanup();
      this.logger.log(`Audit cleanup completed: ${result.deleted} logs deleted`);
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack;
      this.logger.error(`Audit cleanup failed: ${errorMessage}`, errorStack);
      throw error; // Re-throw so controller can handle
    }
  }

  /**
   * Cleanup old alert history (called via POST /cron/cleanup-alert-history)
   * Schedule: Daily at 3 AM (configured in vercel.json)
   */
  async handleAlertHistoryCleanup() {
    this.logger.log('Running scheduled alert history cleanup');
    try {
      await this.alertService.cleanupOldAlerts();
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack;
      this.logger.error(`Alert history cleanup failed: ${errorMessage}`, errorStack);
      throw error; // Re-throw so controller can handle
    }
  }

  /**
   * Cleanup rate limit store (called via POST /cron/cleanup-rate-limits)
   * Schedule: Every hour (configured in vercel.json)
   */
  async handleRateLimitCleanup() {
    this.logger.log('Running scheduled rate limit cleanup');
    try {
      this.rateLimitService.cleanup();
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack;
      this.logger.error(`Rate limit cleanup failed: ${errorMessage}`, errorStack);
      throw error; // Re-throw so controller can handle
    }
  }
}

