import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppScope } from './entities/app-scope.entity';
import { AppWorkflow } from './entities/app-workflow.entity';
import { AppAction } from './entities/app-action.entity';
import { AppsRuntimeController } from './apps-runtime.controller';
import { AppsImportService } from './apps-import.service';
import { RunsModule } from '../runs/runs.module';
import { Workflow } from '../workflows/entities/workflow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([App, AppScope, AppWorkflow, AppAction, Workflow]),
    RunsModule,
  ],
  controllers: [AppsRuntimeController],
  providers: [AppsImportService],
  exports: [AppsImportService],
})
export class AppsModule {}

