import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Run } from '../runs/entities/run.entity';
import { Event } from '../runs/entities/event.entity';
import { Step } from '../runs/entities/step.entity';
import { MemoryItem } from '../memory/entities/memory-item.entity';
import { MetricsService } from './metrics.service';
import { EnhancedMetricsService } from './enhanced-metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Run, Event, Step, MemoryItem])],
  controllers: [MetricsController],
  providers: [MetricsService, EnhancedMetricsService],
  exports: [MetricsService, EnhancedMetricsService],
})
export class MetricsModule {}

