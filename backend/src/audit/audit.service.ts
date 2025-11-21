import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditResourceType } from './entities/audit-log.entity';

export interface AuditLogInput {
  user_id?: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  tenant_id?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Log an audit event
   */
  async log(input: AuditLogInput): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create(input);
      const saved = await this.auditLogRepository.save(auditLog);
      return saved;
    } catch (error) {
      // Don't throw - audit logging should never break the main flow
      this.logger.error(`Failed to log audit event: ${error.message}`, error.stack);
      throw error; // Re-throw for now, but in production might want to swallow
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    action: 'login' | 'logout' | 'failed_login',
    userId?: string,
    email?: string,
    ipAddress?: string,
    userAgent?: string,
    reason?: string,
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      resource_type: 'auth',
      resource_id: userId,
      changes: {
        email,
        reason,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  /**
   * Log resource changes (create/update/delete)
   */
  async logResourceChange(
    action: 'create' | 'update' | 'delete',
    resourceType: AuditResourceType,
    resourceId: string,
    userId?: string,
    changes?: { before?: any; after?: any },
    tenantId?: string,
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      changes,
      tenant_id: tenantId,
    });
  }

  /**
   * Log execution events
   */
  async logExecution(
    resourceType: 'workflow' | 'run' | 'tool' | 'agent',
    resourceId: string,
    userId?: string,
    metadata?: Record<string, any>,
    tenantId?: string,
  ): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'execute',
      resource_type: resourceType,
      resource_id: resourceId,
      changes: metadata,
      tenant_id: tenantId,
    });
  }

  /**
   * Query audit logs
   */
  async queryLogs(filters: {
    user_id?: string;
    resource_type?: AuditResourceType;
    resource_id?: string;
    action?: AuditAction;
    tenant_id?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit_log');

    if (filters.user_id) {
      query.andWhere('audit_log.user_id = :user_id', { user_id: filters.user_id });
    }

    if (filters.resource_type) {
      query.andWhere('audit_log.resource_type = :resource_type', {
        resource_type: filters.resource_type,
      });
    }

    if (filters.resource_id) {
      query.andWhere('audit_log.resource_id = :resource_id', {
        resource_id: filters.resource_id,
      });
    }

    if (filters.action) {
      query.andWhere('audit_log.action = :action', { action: filters.action });
    }

    if (filters.tenant_id) {
      query.andWhere('audit_log.tenant_id = :tenant_id', { tenant_id: filters.tenant_id });
    }

    if (filters.start_date) {
      query.andWhere('audit_log.created_at >= :start_date', { start_date: filters.start_date });
    }

    if (filters.end_date) {
      query.andWhere('audit_log.created_at <= :end_date', { end_date: filters.end_date });
    }

    query.orderBy('audit_log.created_at', 'DESC');

    if (filters.limit) {
      query.limit(filters.limit);
    }

    if (filters.offset) {
      query.offset(filters.offset);
    }

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }
}

