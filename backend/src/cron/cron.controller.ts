import { Controller, Post, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { CronService } from './cron.service';

/**
 * Guard to validate Vercel Cron secret
 * Vercel sends a header 'Authorization: Bearer <CRON_SECRET>'
 */
function validateCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-in-production';
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  return token === cronSecret;
}

@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(private readonly cronService: CronService) {}

  /**
   * Endpoint for Vercel Cron to check alerts
   * Schedule: Every 5 minutes (configured in vercel.json)
   */
  @Post('check-alerts')
  async triggerAlertCheck(@Headers('authorization') authHeader?: string) {
    if (!validateCronSecret(authHeader)) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Triggered alert check via cron endpoint');
    await this.cronService.handleAlertCheck();
    return { status: 'ok', message: 'Alert check completed' };
  }

  /**
   * Endpoint for Vercel Cron to cleanup audit logs
   * Schedule: 0 2 * * * (daily at 2 AM)
   */
  @Post('cleanup-audit')
  async triggerAuditCleanup(@Headers('authorization') authHeader?: string) {
    if (!validateCronSecret(authHeader)) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Triggered audit cleanup via cron endpoint');
    await this.cronService.handleAuditCleanup();
    return { status: 'ok', message: 'Audit cleanup completed' };
  }

  /**
   * Endpoint for Vercel Cron to cleanup alert history
   * Schedule: 0 3 * * * (daily at 3 AM)
   */
  @Post('cleanup-alert-history')
  async triggerAlertHistoryCleanup(@Headers('authorization') authHeader?: string) {
    if (!validateCronSecret(authHeader)) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Triggered alert history cleanup via cron endpoint');
    await this.cronService.handleAlertHistoryCleanup();
    return { status: 'ok', message: 'Alert history cleanup completed' };
  }

  /**
   * Endpoint for Vercel Cron to cleanup rate limit store
   * Schedule: 0 * * * * (every hour)
   */
  @Post('cleanup-rate-limits')
  async triggerRateLimitCleanup(@Headers('authorization') authHeader?: string) {
    if (!validateCronSecret(authHeader)) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    this.logger.log('Triggered rate limit cleanup via cron endpoint');
    await this.cronService.handleRateLimitCleanup();
    return { status: 'ok', message: 'Rate limit cleanup completed' };
  }
}

