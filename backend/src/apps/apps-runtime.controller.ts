import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from './entities/app.entity';
import { AppAction } from './entities/app-action.entity';
import { AppWorkflow } from './entities/app-workflow.entity';
import { OrchestratorService } from '../execution/orchestrator.service';
import { AppsImportService } from './apps-import.service';
import { AppScopeCheckerService } from './services/app-scope-checker.service';
import { PolicyEngineV1Service } from '../policies/policy-engine-v1.service';
import { ForbiddenException } from '@nestjs/common';

interface ExecuteActionDto {
  event?: Record<string, any>;
  context?: {
    user_id?: string;
    tenant_id?: string;
    mode?: 'draft' | 'auto'; // Allow override of default_mode
    [key: string]: any;
  };
}

@Controller('apps')
export class AppsRuntimeController {
  private readonly logger = new Logger(AppsRuntimeController.name);

  constructor(
    @InjectRepository(App)
    private appRepository: Repository<App>,
    @InjectRepository(AppAction)
    private appActionRepository: Repository<AppAction>,
    @InjectRepository(AppWorkflow)
    private appWorkflowRepository: Repository<AppWorkflow>,
    private orchestratorService: OrchestratorService,
    private appsImportService: AppsImportService,
    private scopeChecker: AppScopeCheckerService,
    private policyEngineV1: PolicyEngineV1Service,
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

  @Get(':app_id/actions')
  async listAppActions(@Param('app_id') appId: string) {
    const actions = await this.appActionRepository.find({
      where: { app_id: appId },
      relations: ['app_workflow', 'app_workflow.workflow'],
    });

    // Return actions with resolved input_mapping info
    return actions.map((action) => ({
      id: action.action_id,
      label: action.label,
      workflow_id: action.app_workflow.workflow?.id,
      workflow_alias: action.app_workflow.alias,
      input_mapping: action.input_mapping,
    }));
  }

  @Get(':app_id/scopes')
  async getAppScopes(@Param('app_id') appId: string) {
    const app = await this.appRepository.findOne({
      where: { id: appId },
    });

    if (!app) {
      throw new NotFoundException(`App with ID ${appId} not found`);
    }

    const scopes = await this.scopeChecker.getAppScopes(appId);

    return {
      app_id: appId,
      scopes: scopes.map((scope) => ({
        type: scope.scope_type,
        value: scope.scope_value,
      })),
    };
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
    // TODO: Add strict mode based on app/workflow configuration
    const strictMode = false; // Can be enabled per app or workflow
    const workflowInput = this.buildWorkflowInput(
      appAction.input_mapping,
      body.event || {},
      body.context || {},
      strictMode,
    );

    // Determine mode: use context override if provided, otherwise use app workflow default_mode
    const mode = body.context?.mode || appWorkflow.default_mode;

    // Validate mode override (if provided, must be valid)
    if (body.context?.mode && !['draft', 'auto'].includes(body.context.mode)) {
      throw new BadRequestException(
        `Invalid mode: ${body.context.mode}. Mode must be 'draft' or 'auto'`,
      );
    }

    // Policy check for run start
    const policyDecision = await this.policyEngineV1.checkRunStart(workflow.id, {
      appId,
      userId: body.context?.user_id,
      tenantId: body.context?.tenant_id || 'default-tenant',
      mode,
      input: workflowInput,
    });

    if (!policyDecision.allowed) {
      if (policyDecision.requiresApproval) {
        throw new BadRequestException(
          `Run requires approval: ${policyDecision.reason || 'Policy requires human approval'}`,
        );
      }
      throw new ForbiddenException(
        `Policy denied starting run for app ${appId}, action ${actionId}: ${policyDecision.reason || 'Run not allowed'}`,
      );
    }

    // Apply policy modifications (e.g., mode override, input modifications)
    const finalMode = policyDecision.modifiedContext?.mode_override || mode;
    const finalInput = {
      ...workflowInput,
      ...(policyDecision.modifiedContext?.input_modifications || {}),
    };

    // Start run via orchestrator
    const run = await this.orchestratorService.startRun(
      workflow.id,
      finalInput,
      finalMode,
      body.context?.tenant_id || 'default-tenant',
      body.context?.user_id,
      appId,
      actionId,
      policyDecision.modifiedContext, // Pass modified context from policy
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
    strictMode: boolean = false,
  ): Record<string, any> {
    const workflowInput: Record<string, any> = {};
    const unresolvedPaths: string[] = [];

    for (const [key, value] of Object.entries(inputMapping)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Resolve variable reference
        const path = value.substring(1); // Remove $
        const parts = path.split('.');

        let resolved: any = undefined;

        if (parts[0] === 'context') {
          // Resolve from context
          resolved = context;
          for (let i = 1; i < parts.length; i++) {
            resolved = resolved?.[parts[i]];
          }
        } else if (parts[0] === 'event') {
          // Resolve from event
          resolved = event;
          for (let i = 1; i < parts.length; i++) {
            resolved = resolved?.[parts[i]];
          }
        } else {
          // Direct value
          resolved = value;
        }

        // Log warning if path resolves to undefined
        if (resolved === undefined) {
          unresolvedPaths.push(`$${path}`);
          this.logger.warn(
            `Input mapping path resolved to undefined: $${path} for key ${key}`,
            { path, key, event, context },
          );
        }

        workflowInput[key] = resolved;
      } else {
        // Static value
        workflowInput[key] = value;
      }
    }

    // In strict mode, throw error if any paths are unresolved
    if (strictMode && unresolvedPaths.length > 0) {
      throw new Error(
        `Input mapping validation failed: The following paths resolved to undefined: ${unresolvedPaths.join(', ')}`,
      );
    }

    return workflowInput;
  }
}

