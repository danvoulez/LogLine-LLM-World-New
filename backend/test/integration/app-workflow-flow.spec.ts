import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { App } from '../../src/apps/entities/app.entity';
import { AppScope } from '../../src/apps/entities/app-scope.entity';
import { AppWorkflow } from '../../src/apps/entities/app-workflow.entity';
import { AppAction } from '../../src/apps/entities/app-action.entity';
import { Workflow } from '../../src/workflows/entities/workflow.entity';
import { Run } from '../../src/runs/entities/run.entity';
import { Step } from '../../src/runs/entities/step.entity';
import { Event } from '../../src/runs/entities/event.entity';
import { Tool } from '../../src/tools/entities/tool.entity';
import { AppsModule } from '../../src/apps/apps.module';
import { WorkflowsModule } from '../../src/workflows/workflows.module';
import { RunsModule } from '../../src/runs/runs.module';
import { ToolsModule } from '../../src/tools/tools.module';
import { AppsImportService } from '../../src/apps/apps-import.service';
import { OrchestratorService } from '../../src/execution/orchestrator.service';

describe('App Workflow Flow Integration', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let appsImportService: AppsImportService;
  let orchestratorService: OrchestratorService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'user',
          password: process.env.DB_PASSWORD || 'password',
          database: process.env.DB_DATABASE || 'logline_test',
          entities: [
            App,
            AppScope,
            AppWorkflow,
            AppAction,
            Workflow,
            Run,
            Step,
            Event,
            Tool,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        AppsModule,
        WorkflowsModule,
        RunsModule,
        ToolsModule,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    appsImportService = module.get<AppsImportService>(AppsImportService);
    orchestratorService = module.get<OrchestratorService>(OrchestratorService);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.synchronize(true);
  });

  it('should import app manifest and execute action with scope enforcement', async () => {
    // 1. Create a workflow
    const workflow = await dataSource.getRepository(Workflow).save({
      name: 'test-workflow',
      version: '1.0.0',
      definition: {
        nodes: [
          {
            id: 'start',
            type: 'static',
            config: { output: { message: 'Hello' } },
          },
          {
            id: 'query',
            type: 'tool',
            config: { tool_id: 'natural_language_db_read' },
          },
        ],
        edges: [{ from: 'start', to: 'query' }],
        entryNode: 'start',
      },
      type: 'linear',
    });

    // 2. Ensure tool exists
    await dataSource.getRepository(Tool).save({
      id: 'natural_language_db_read',
      name: 'Natural Language DB Read',
      description: 'Read from database',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      handler_type: 'builtin',
    });

    // 3. Import app manifest
    const manifest = {
      version: '1.0.0',
      app: {
        id: 'test-app',
        name: 'Test App',
        scopes: {
          tools: ['natural_language_db_read'],
        },
        workflows: [
          {
            id: 'main',
            workflow_ref: workflow.id,
            label: 'Main Workflow',
          },
        ],
        actions: [
          {
            id: 'query',
            label: 'Query Database',
            workflow_id: 'main',
            input_mapping: {
              query: '$context.query',
            },
          },
        ],
      },
    };

    const app = await appsImportService.importManifest(manifest);
    expect(app).toBeDefined();
    expect(app.id).toBe('test-app');
    expect(app.scopes).toHaveLength(1);
    expect(app.scopes[0].scope_value).toBe('natural_language_db_read');

    // 4. Execute app action (should work with scope)
    const run = await orchestratorService.startRun(
      workflow.id,
      { query: 'Show me all workflows' },
      'draft',
      'test-tenant',
      undefined,
      app.id,
      'query',
    );

    expect(run).toBeDefined();
    expect(run.app_id).toBe(app.id);
    expect(run.app_action_id).toBe('query');
  });

  it('should deny tool call if app does not have scope', async () => {
    // Create workflow with tool node
    const workflow = await dataSource.getRepository(Workflow).save({
      name: 'test-workflow',
      version: '1.0.0',
      definition: {
        nodes: [
          {
            id: 'write',
            type: 'tool',
            config: { tool_id: 'natural_language_db_write' },
          },
        ],
        edges: [],
        entryNode: 'write',
      },
      type: 'linear',
    });

    // Ensure tool exists
    await dataSource.getRepository(Tool).save({
      id: 'natural_language_db_write',
      name: 'Natural Language DB Write',
      description: 'Write to database',
      input_schema: {
        type: 'object',
        properties: { instruction: { type: 'string' } },
        required: ['instruction'],
      },
      handler_type: 'builtin',
    });

    // Import app WITHOUT write tool scope
    const manifest = {
      version: '1.0.0',
      app: {
        id: 'read-only-app',
        name: 'Read Only App',
        scopes: {
          tools: ['natural_language_db_read'], // Only read, not write
        },
        workflows: [
          {
            id: 'main',
            workflow_ref: workflow.id,
            label: 'Main Workflow',
          },
        ],
        actions: [
          {
            id: 'write',
            label: 'Write (should fail)',
            workflow_id: 'main',
            input_mapping: {},
          },
        ],
      },
    };

    const app = await appsImportService.importManifest(manifest);

    // Try to execute - should fail with scope denied
    await expect(
      orchestratorService.startRun(
        workflow.id,
        { instruction: 'Insert a test record' },
        'draft',
        'test-tenant',
        undefined,
        app.id,
        'write',
      ),
    ).rejects.toThrow();
  });
});

