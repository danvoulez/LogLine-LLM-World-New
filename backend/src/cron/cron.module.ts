import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';
import { RateLimitingModule } from '../rate-limiting/rate-limiting.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AlertsModule,
    AuditModule,
    RateLimitingModule,
  ],
  providers: [CronService],
})
export class CronModule {}

