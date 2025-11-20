import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { OrchestratorService } from '../execution/orchestrator.service';
import { Run } from './entities/run.entity';
import { Step } from './entities/step.entity';
import { Event } from './entities/event.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { AgentsModule } from '../agents/agents.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Run, Step, Event, Workflow]),
    AgentsModule,
    ToolsModule,
  ],
  controllers: [RunsController],
  providers: [RunsService, OrchestratorService],
  exports: [RunsService, OrchestratorService],
})
export class RunsModule {}

