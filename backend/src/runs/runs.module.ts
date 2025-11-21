import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { OrchestratorService } from '../execution/orchestrator.service';
import { BudgetTrackerService } from '../execution/budget-tracker.service';
import { Run } from './entities/run.entity';
import { Step } from './entities/step.entity';
import { Event } from './entities/event.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { AgentsModule } from '../agents/agents.module';
import { ToolsModule } from '../tools/tools.module';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Run, Step, Event, Workflow]),
    forwardRef(() => AgentsModule),
    forwardRef(() => ToolsModule),
    PoliciesModule, // NEW
  ],
  controllers: [RunsController],
  providers: [RunsService, OrchestratorService, BudgetTrackerService],
  exports: [RunsService, OrchestratorService, BudgetTrackerService],
})
export class RunsModule {}
