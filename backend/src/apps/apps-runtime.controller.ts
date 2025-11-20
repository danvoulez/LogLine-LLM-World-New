import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from './entities/app.entity';
import { AppAction } from './entities/app-action.entity';
import { AppWorkflow } from './entities/app-workflow.entity';
import { OrchestratorService } from '../execution/orchestrator.service';
import { AppsImportService } from './apps-import.service';

interface ExecuteActionDto {
  event?: Record<string, any>;
  context?: {
    user_id?: string;
    tenant_id?: string;
    [key: string]: any;
  };
}

@Controller('apps')
export class AppsRuntimeController {
  constructor(
    @InjectRepository(App)
    private appRepository: Repository<App>,
    @InjectRepository(AppAction)
    private appActionRepository: Repository<AppAction>,
    @InjectRepository(AppWorkflow)
    private appWorkflowRepository: Repository<AppWorkflow>,
    private orchestratorService: OrchestratorService,
    private appsImportService: AppsImportService,
  ) {}

  @Get()
  async listApps(): Promise<App[]> {
    return this.appRepository.find({
      relations: ['scopes', 'workflows', 'actions'],
    });
  }

  @Post('import')
  async importApp(@Body() manifest: any): Promise<App> {
    return this.appsImportService.importManifest(manifest);
  }

  @Get(':app_id')
  async getApp(@Param('app_id') appId: string): Promise<App> {
    const app = await this.appRepository.findOne({
      where: { id: appId },
      relations: ['scopes', 'workflows', 'actions'],
    });

    if (!app) {
      throw new NotFoundException(`App with ID ${appId} not found`);
    }

    return app;
  }

  @Post(':app_id/actions/:action_id')
  async executeAction(
    @Param('app_id') appId: string,
    @Param('action_id') actionId: string,
    @Body() body: ExecuteActionDto,
  ) {
    // Find the app action
    const appAction = await this.appActionRepository.findOne({
      where: {
        app_id: appId,
        action_id: actionId,
      },
      relations: ['app_workflow', 'app_workflow.workflow'],
    });

    if (!appAction) {
      throw new NotFoundException(
        `Action ${actionId} not found in app ${appId}`,
      );
    }

    // Resolve workflow from app workflow
    const appWorkflow = appAction.app_workflow;
    const workflow = appWorkflow.workflow;

    if (!workflow) {
      throw new NotFoundException(
        `Workflow not found for action ${actionId}`,
      );
    }

    // Build workflow input from input_mapping
    const workflowInput = this.buildWorkflowInput(
      appAction.input_mapping,
      body.event || {},
      body.context || {},
    );

    // Start run via orchestrator
    const run = await this.orchestratorService.startRun(
      workflow.id,
      workflowInput,
      appWorkflow.default_mode,
      body.context?.tenant_id || 'default-tenant',
      body.context?.user_id,
      appId,
      actionId,
    );

    return {
      run_id: run.id,
      status: run.status,
      workflow_id: workflow.id,
      app_id: appId,
      app_action_id: actionId,
    };
  }

  private buildWorkflowInput(
    inputMapping: Record<string, any>,
    event: Record<string, any>,
    context: Record<string, any>,
  ): Record<string, any> {
    const workflowInput: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputMapping)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Resolve variable reference
        const path = value.substring(1); // Remove $
        const parts = path.split('.');

        if (parts[0] === 'context') {
          // Resolve from context
          let resolved = context;
          for (let i = 1; i < parts.length; i++) {
            resolved = resolved?.[parts[i]];
          }
          workflowInput[key] = resolved;
        } else if (parts[0] === 'event') {
          // Resolve from event
          let resolved = event;
          for (let i = 1; i < parts.length; i++) {
            resolved = resolved?.[parts[i]];
          }
          workflowInput[key] = resolved;
        } else {
          // Direct value
          workflowInput[key] = value;
        }
      } else {
        // Static value
        workflowInput[key] = value;
      }
    }

    return workflowInput;
  }
}

