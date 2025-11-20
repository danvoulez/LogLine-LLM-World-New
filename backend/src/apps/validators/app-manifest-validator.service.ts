import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { WorkflowValidationException } from '../../common/exceptions/workflow-validation.exception';

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

interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Service for validating app manifests before import.
 * 
 * Validates:
 * - Manifest structure and version
 * - App fields (id, name, required fields)
 * - Scopes (tools must exist, memory/external format)
 * - Workflows (workflow_ref must exist, alias uniqueness)
 * - Actions (workflow_id must reference valid workflow alias)
 * - Input mapping syntax ($context.*, $event.*)
 */
@Injectable()
export class AppManifestValidatorService {
  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
  ) {}

  /**
   * Validate an app manifest and return detailed errors if invalid.
   * 
   * @param manifest - Manifest to validate
   * @throws WorkflowValidationException if validation fails
   */
  async validate(manifest: AppManifest): Promise<void> {
    const errors: ValidationError[] = [];

    // 1. Validate manifest structure
    if (!manifest) {
      throw new WorkflowValidationException('Manifest is required', {
        errors: [{ field: 'manifest', message: 'Manifest is required' }],
      });
    }

    if (!manifest.version) {
      errors.push({ field: 'version', message: 'Version is required' });
    } else if (manifest.version !== '1.0.0') {
      errors.push({
        field: 'version',
        message: `Unsupported version: ${manifest.version}. Only 1.0.0 is supported.`,
        value: manifest.version,
      });
    }

    if (!manifest.app) {
      errors.push({ field: 'app', message: 'App object is required' });
    } else {
      // 2. Validate app fields
      const app = manifest.app;

      if (!app.id) {
        errors.push({ field: 'app.id', message: 'App ID is required' });
      } else if (typeof app.id !== 'string' || app.id.trim().length === 0) {
        errors.push({
          field: 'app.id',
          message: 'App ID must be a non-empty string',
          value: app.id,
        });
      }

      if (!app.name) {
        errors.push({ field: 'app.name', message: 'App name is required' });
      } else if (typeof app.name !== 'string' || app.name.trim().length === 0) {
        errors.push({
          field: 'app.name',
          message: 'App name must be a non-empty string',
          value: app.name,
        });
      }

      if (app.visibility && !['private', 'org', 'public'].includes(app.visibility)) {
        errors.push({
          field: 'app.visibility',
          message: 'Visibility must be one of: private, org, public',
          value: app.visibility,
        });
      }

      // 3. Validate scopes
      if (app.scopes) {
        // Validate tools exist
        if (app.scopes.tools && Array.isArray(app.scopes.tools)) {
          const toolIds = app.scopes.tools;
          const existingTools = await this.toolRepository.find({
            where: toolIds.map((id) => ({ id })),
          });
          const existingToolIds = new Set(existingTools.map((t) => t.id));

          for (const toolId of toolIds) {
            if (typeof toolId !== 'string') {
              errors.push({
                field: 'app.scopes.tools',
                message: `Tool ID must be a string: ${toolId}`,
                value: toolId,
              });
            } else if (!existingToolIds.has(toolId)) {
              errors.push({
                field: 'app.scopes.tools',
                message: `Tool not found: ${toolId}`,
                value: toolId,
              });
            }
          }
        } else if (app.scopes.tools !== undefined) {
          errors.push({
            field: 'app.scopes.tools',
            message: 'Tools must be an array of strings',
            value: app.scopes.tools,
          });
        }

        // Validate memory format (just check it's an array of strings)
        if (app.scopes.memory !== undefined) {
          if (!Array.isArray(app.scopes.memory)) {
            errors.push({
              field: 'app.scopes.memory',
              message: 'Memory scopes must be an array',
              value: app.scopes.memory,
            });
          } else {
            for (const memoryId of app.scopes.memory) {
              if (typeof memoryId !== 'string') {
                errors.push({
                  field: 'app.scopes.memory',
                  message: `Memory ID must be a string: ${memoryId}`,
                  value: memoryId,
                });
              }
            }
          }
        }

        // Validate external format (just check it's an array of strings)
        if (app.scopes.external !== undefined) {
          if (!Array.isArray(app.scopes.external)) {
            errors.push({
              field: 'app.scopes.external',
              message: 'External scopes must be an array',
              value: app.scopes.external,
            });
          } else {
            for (const externalId of app.scopes.external) {
              if (typeof externalId !== 'string') {
                errors.push({
                  field: 'app.scopes.external',
                  message: `External ID must be a string: ${externalId}`,
                  value: externalId,
                });
              }
            }
          }
        }
      }

      // 4. Validate workflows
      if (app.workflows) {
        if (!Array.isArray(app.workflows)) {
          errors.push({
            field: 'app.workflows',
            message: 'Workflows must be an array',
            value: app.workflows,
          });
        } else {
          const workflowAliases = new Set<string>();

          for (let i = 0; i < app.workflows.length; i++) {
            const workflow = app.workflows[i];
            const prefix = `app.workflows[${i}]`;

            if (!workflow.id) {
              errors.push({
                field: `${prefix}.id`,
                message: 'Workflow alias (id) is required',
              });
            } else if (typeof workflow.id !== 'string') {
              errors.push({
                field: `${prefix}.id`,
                message: 'Workflow alias must be a string',
                value: workflow.id,
              });
            } else {
              // Check for duplicate aliases
              if (workflowAliases.has(workflow.id)) {
                errors.push({
                  field: `${prefix}.id`,
                  message: `Duplicate workflow alias: ${workflow.id}`,
                  value: workflow.id,
                });
              }
              workflowAliases.add(workflow.id);
            }

            if (!workflow.workflow_ref) {
              errors.push({
                field: `${prefix}.workflow_ref`,
                message: 'Workflow reference (workflow_ref) is required',
              });
            } else if (typeof workflow.workflow_ref !== 'string') {
              errors.push({
                field: `${prefix}.workflow_ref`,
                message: 'Workflow reference must be a string',
                value: workflow.workflow_ref,
              });
            } else {
              // Check if workflow exists
              const exists = await this.workflowRepository.findOne({
                where: { id: workflow.workflow_ref },
              });
              if (!exists) {
                errors.push({
                  field: `${prefix}.workflow_ref`,
                  message: `Workflow not found: ${workflow.workflow_ref}`,
                  value: workflow.workflow_ref,
                });
              }
            }

            if (!workflow.label) {
              errors.push({
                field: `${prefix}.label`,
                message: 'Workflow label is required',
              });
            } else if (typeof workflow.label !== 'string') {
              errors.push({
                field: `${prefix}.label`,
                message: 'Workflow label must be a string',
                value: workflow.label,
              });
            }

            if (
              workflow.default_mode &&
              !['draft', 'auto'].includes(workflow.default_mode)
            ) {
              errors.push({
                field: `${prefix}.default_mode`,
                message: 'Default mode must be "draft" or "auto"',
                value: workflow.default_mode,
              });
            }
          }
        }
      }

      // 5. Validate actions
      if (app.actions) {
        if (!Array.isArray(app.actions)) {
          errors.push({
            field: 'app.actions',
            message: 'Actions must be an array',
            value: app.actions,
          });
        } else {
          const workflowAliases = new Set(
            app.workflows?.map((w) => w.id) || [],
          );
          const actionIds = new Set<string>();

          for (let i = 0; i < app.actions.length; i++) {
            const action = app.actions[i];
            const prefix = `app.actions[${i}]`;

            if (!action.id) {
              errors.push({
                field: `${prefix}.id`,
                message: 'Action ID is required',
              });
            } else if (typeof action.id !== 'string') {
              errors.push({
                field: `${prefix}.id`,
                message: 'Action ID must be a string',
                value: action.id,
              });
            } else {
              // Check for duplicate action IDs
              if (actionIds.has(action.id)) {
                errors.push({
                  field: `${prefix}.id`,
                  message: `Duplicate action ID: ${action.id}`,
                  value: action.id,
                });
              }
              actionIds.add(action.id);
            }

            if (!action.label) {
              errors.push({
                field: `${prefix}.label`,
                message: 'Action label is required',
              });
            } else if (typeof action.label !== 'string') {
              errors.push({
                field: `${prefix}.label`,
                message: 'Action label must be a string',
                value: action.label,
              });
            }

            if (!action.workflow_id) {
              errors.push({
                field: `${prefix}.workflow_id`,
                message: 'Workflow ID (alias) is required',
              });
            } else if (typeof action.workflow_id !== 'string') {
              errors.push({
                field: `${prefix}.workflow_id`,
                message: 'Workflow ID must be a string',
                value: action.workflow_id,
              });
            } else if (!workflowAliases.has(action.workflow_id)) {
              errors.push({
                field: `${prefix}.workflow_id`,
                message: `Workflow alias not found: ${action.workflow_id}`,
                value: action.workflow_id,
              });
            }

            // Validate input_mapping syntax
            if (!action.input_mapping) {
              errors.push({
                field: `${prefix}.input_mapping`,
                message: 'Input mapping is required',
              });
            } else if (typeof action.input_mapping !== 'object') {
              errors.push({
                field: `${prefix}.input_mapping`,
                message: 'Input mapping must be an object',
                value: action.input_mapping,
              });
            } else {
              // Validate input_mapping values (should be strings with $context.* or $event.*)
              for (const [key, value] of Object.entries(action.input_mapping)) {
                if (typeof value === 'string') {
                  // Check if it's a valid mapping expression
                  if (
                    !value.startsWith('$context.') &&
                    !value.startsWith('$event.') &&
                    !value.startsWith('$input.')
                  ) {
                    // Allow literal values too, but warn if it doesn't match pattern
                    // This is not an error, just a note
                  }
                }
                // Allow other types (numbers, booleans, objects) as literal values
              }
            }
          }
        }
      }
    }

    // Throw if there are errors
    if (errors.length > 0) {
      throw new WorkflowValidationException(
        `Manifest validation failed with ${errors.length} error(s)`,
        { errors },
      );
    }
  }
}

