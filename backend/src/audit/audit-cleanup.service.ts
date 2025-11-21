import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditCleanupService {
  private readonly logger = new Logger(AuditCleanupService.name);
  private readonly RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Cleanup old audit logs (older than retention period)
   */
  async cleanup(): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    const result = await this.auditLogRepository.delete({
      created_at: LessThan(cutoffDate),
    });

    this.logger.log(
      `Cleaned up ${result.affected || 0} audit logs older than ${this.RETENTION_DAYS} days`,
    );

    return { deleted: result.affected || 0 };
  }

  /**
   * Get audit log statistics
   */
  async getStats(): Promise<{
    total: number;
    oldest: Date | null;
    newest: Date | null;
    size_mb: number;
  }> {
    const total = await this.auditLogRepository.count();

    const oldest = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('MIN(log.created_at)', 'oldest')
      .getRawOne();

    const newest = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('MAX(log.created_at)', 'newest')
      .getRawOne();

    // Estimate size (rough calculation)
    const avgLogSize = 500; // bytes per log entry (rough estimate)
    const sizeMb = (total * avgLogSize) / (1024 * 1024);

    return {
      total,
      oldest: oldest?.oldest || null,
      newest: newest?.newest || null,
      size_mb: sizeMb,
    };
  }
}

