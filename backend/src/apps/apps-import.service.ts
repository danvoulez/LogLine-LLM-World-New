import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { App, AppVisibility } from './entities/app.entity';
import { AppScope, ScopeType } from './entities/app-scope.entity';
import { AppWorkflow } from './entities/app-workflow.entity';
import { AppAction } from './entities/app-action.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { RunMode } from '../runs/entities/run.entity';
import { AppManifestValidatorService } from './validators/app-manifest-validator.service';

interface AppManifest {
  version: string;
  app: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    owner?: string;
    visibility?: 'private' | 'org' | 'public';
    scopes?: {
      tools?: string[];
      memory?: string[];
      external?: string[];
    };
    workflows?: Array<{
      id: string;
      workflow_ref: string;
      label: string;
      default_mode?: 'draft' | 'auto';
    }>;
    actions?: Array<{
      id: string;
      label: string;
      workflow_id: string;
      input_mapping: Record<string, any>;
    }>;
  };
}

@Injectable()
export class AppsImportService {
  constructor(
    @InjectRepository(App)
    private appRepository: Repository<App>,
    @InjectRepository(AppScope)
    private appScopeRepository: Repository<AppScope>,
    @InjectRepository(AppWorkflow)
    private appWorkflowRepository: Repository<AppWorkflow>,
    @InjectRepository(AppAction)
    private appActionRepository: Repository<AppAction>,
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    private manifestValidator: AppManifestValidatorService,
    private dataSource: DataSource,
  ) {}

  async importManifest(manifest: AppManifest): Promise<App> {
    // Validate manifest (comprehensive validation)
    await this.manifestValidator.validate(manifest);

    const appData = manifest.app;

    // Upsert app
    let app = await this.appRepository.findOne({ where: { id: appData.id } });
    
    if (app) {
      // Update existing app
      app.name = appData.name;
      app.icon = appData.icon ?? null;
      app.description = appData.description ?? null;
      app.owner = appData.owner ?? null;
      app.visibility = this.mapVisibility(appData.visibility);
      app.updated_at = new Date();
    } else {
      // Create new app
      app = new App();
      app.id = appData.id;
      app.name = appData.name;
      app.icon = appData.icon ?? null;
      app.description = appData.description ?? null;
      app.owner = appData.owner ?? null;
      app.visibility = this.mapVisibility(appData.visibility);
    }

    app = await this.appRepository.save(app);

    // Use transaction to prevent race conditions during import
    // This ensures delete and insert operations are atomic
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Clear existing scopes, workflows, and actions (within transaction)
      await queryRunner.manager.delete(AppScope, { app_id: app.id });
      await queryRunner.manager.delete(AppAction, { app_id: app.id });
      await queryRunner.manager.delete(AppWorkflow, { app_id: app.id });

      // Insert scopes
    if (appData.scopes) {
      const scopePromises: Promise<AppScope>[] = [];

      if (appData.scopes.tools) {
        for (const toolId of appData.scopes.tools) {
          const scope = queryRunner.manager.create(AppScope, {
            app_id: app.id,
            scope_type: ScopeType.TOOL,
            scope_value: toolId,
          });
          scopePromises.push(queryRunner.manager.save(scope));
        }
      }

      if (appData.scopes.memory) {
        for (const memoryId of appData.scopes.memory) {
          const scope = queryRunner.manager.create(AppScope, {
            app_id: app.id,
            scope_type: ScopeType.MEMORY,
            scope_value: memoryId,
          });
          scopePromises.push(queryRunner.manager.save(scope));
        }
      }

      if (appData.scopes.external) {
        for (const externalId of appData.scopes.external) {
          const scope = queryRunner.manager.create(AppScope, {
            app_id: app.id,
            scope_type: ScopeType.EXTERNAL,
            scope_value: externalId,
          });
          scopePromises.push(queryRunner.manager.save(scope));
        }
      }

      await Promise.all(scopePromises);
    }

    // Insert workflows
    const workflowMap = new Map<string, AppWorkflow>();

    if (appData.workflows) {
      for (const workflowDef of appData.workflows) {
        // Find workflow by workflow_ref (which should match workflow.id)
        const workflow = await this.workflowRepository.findOne({
          where: { id: workflowDef.workflow_ref },
        });

        if (!workflow) {
          throw new NotFoundException(
            `Workflow not found: ${workflowDef.workflow_ref}`,
          );
        }

        const appWorkflow = queryRunner.manager.create(AppWorkflow, {
          app_id: app.id,
          alias: workflowDef.id,
          workflow_id: workflow.id,
          label: workflowDef.label,
          default_mode: this.mapRunMode(workflowDef.default_mode),
        });

        const saved = await queryRunner.manager.save(appWorkflow);
        workflowMap.set(workflowDef.id, saved);
      }
    }

    // Insert actions
    if (appData.actions) {
      for (const actionDef of appData.actions) {
        const appWorkflow = workflowMap.get(actionDef.workflow_id);

        if (!appWorkflow) {
          throw new NotFoundException(
            `Workflow alias not found: ${actionDef.workflow_id}`,
          );
        }

        const appAction = queryRunner.manager.create(AppAction, {
          app_id: app.id,
          action_id: actionDef.id,
          label: actionDef.label,
          app_workflow_id: appWorkflow.id,
          input_mapping: actionDef.input_mapping,
        });

        await queryRunner.manager.save(appAction);
      }
    }

      // Commit transaction
      await queryRunner.commitTransaction();
    } catch (error) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }

    // Reload app with relations
    return this.appRepository.findOne({
      where: { id: app.id },
      relations: ['scopes', 'workflows', 'actions'],
    }) as Promise<App>;
  }

  private mapVisibility(
    visibility?: 'private' | 'org' | 'public',
  ): AppVisibility {
    switch (visibility) {
      case 'org':
        return AppVisibility.ORG;
      case 'public':
        return AppVisibility.PUBLIC;
      default:
        return AppVisibility.PRIVATE;
    }
  }

  private mapRunMode(mode?: 'draft' | 'auto'): RunMode {
    return mode === 'auto' ? RunMode.AUTO : RunMode.DRAFT;
  }
}

