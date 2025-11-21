import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertConfig } from './entities/alert-config.entity';
import { AlertHistory } from './entities/alert-history.entity';
import { AlertService } from './alert.service';
import { AlertsController } from './alerts.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { Run } from '../runs/entities/run.entity';
import { Event } from '../runs/entities/event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertConfig, AlertHistory, Run, Event]),
    MetricsModule,
  ],
  controllers: [AlertsController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertsModule {}

