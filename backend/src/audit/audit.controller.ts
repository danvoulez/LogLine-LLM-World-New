import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';
import type { AuditAction, AuditResourceType } from './entities/audit-log.entity';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'developer') // Only admins and developers can view audit logs
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  async getLogs(
    @Query('user_id') userId?: string,
    @Query('resource_type') resourceType?: AuditResourceType,
    @Query('resource_id') resourceId?: string,
    @Query('action') action?: AuditAction,
    @Query('tenant_id') tenantId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        throw new BadRequestException('Invalid start_date format. Use ISO 8601 format.');
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        throw new BadRequestException('Invalid end_date format. Use ISO 8601 format.');
      }
    }

    const result = await this.auditService.queryLogs({
      user_id: userId,
      resource_type: resourceType,
      resource_id: resourceId,
      action,
      tenant_id: tenantId,
      start_date: startDateObj,
      end_date: endDateObj,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return {
      logs: result.logs,
      total: result.total,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    };
  }
}

