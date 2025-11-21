import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppScope } from './entities/app-scope.entity';
import { AppWorkflow } from './entities/app-workflow.entity';
import { AppAction } from './entities/app-action.entity';
import { AppsRuntimeController } from './apps-runtime.controller';
import { AppsImportService } from './apps-import.service';
import { AppScopeCheckerService } from './services/app-scope-checker.service';
import { AppManifestValidatorService } from './validators/app-manifest-validator.service';
import { RunsModule } from '../runs/runs.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ToolsModule } from '../tools/tools.module';
import { PoliciesModule } from '../policies/policies.module';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Tool } from '../tools/entities/tool.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([App, AppScope, AppWorkflow, AppAction, Workflow, Tool]),
    forwardRef(() => RunsModule),
    WorkflowsModule,
    forwardRef(() => ToolsModule),
    PoliciesModule,
  ],
  controllers: [AppsRuntimeController],
  providers: [
    AppsImportService,
    AppScopeCheckerService,
    AppManifestValidatorService,
  ],
  exports: [AppsImportService, AppScopeCheckerService],
})
export class AppsModule {}

