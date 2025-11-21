import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditCleanupService } from './audit-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, AuditCleanupService],
  controllers: [AuditController],
  exports: [AuditService, AuditCleanupService],
})
export class AuditModule {}

