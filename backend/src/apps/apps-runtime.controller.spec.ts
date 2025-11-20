import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppsRuntimeController } from './apps-runtime.controller';
import { App } from './entities/app.entity';
import { AppAction } from './entities/app-action.entity';
import { AppWorkflow } from './entities/app-workflow.entity';
import { OrchestratorService } from '../execution/orchestrator.service';
import { AppsImportService } from './apps-import.service';
import { NotFoundException } from '@nestjs/common';
import { Workflow } from '../workflows/entities/workflow.entity';

describe('AppsRuntimeController', () => {
  let controller: AppsRuntimeController;
  let appRepository: Repository<App>;
  let appActionRepository: Repository<AppAction>;
  let appWorkflowRepository: Repository<AppWorkflow>;
  let orchestratorService: OrchestratorService;

  const mockAppRepository = {
    findOne: jest.fn(),
  };

  const mockAppActionRepository = {
    findOne: jest.fn(),
  };

  const mockAppWorkflowRepository = {
    findOne: jest.fn(),
  };

  const mockOrchestratorService = {
    startRun: jest.fn(),
  };

  const mockAppsImportService = {
    importManifest: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppsRuntimeController],
      providers: [
        {
          provide: getRepositoryToken(App),
          useValue: mockAppRepository,
        },
        {
          provide: getRepositoryToken(AppAction),
          useValue: mockAppActionRepository,
        },
        {
          provide: getRepositoryToken(AppWorkflow),
          useValue: mockAppWorkflowRepository,
        },
        {
          provide: OrchestratorService,
          useValue: mockOrchestratorService,
        },
        {
          provide: AppsImportService,
          useValue: mockAppsImportService,
        },
      ],
    }).compile();

    controller = module.get<AppsRuntimeController>(AppsRuntimeController);
    appRepository = module.get<Repository<App>>(getRepositoryToken(App));
    appActionRepository = module.get<Repository<AppAction>>(
      getRepositoryToken(AppAction),
    );
    appWorkflowRepository = module.get<Repository<AppWorkflow>>(
      getRepositoryToken(AppWorkflow),
    );
    orchestratorService = module.get<OrchestratorService>(OrchestratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getApp', () => {
    it('should return an app', async () => {
      const app = {
        id: 'app-123',
        name: 'Test App',
        scopes: [],
        workflows: [],
        actions: [],
      };

      mockAppRepository.findOne.mockResolvedValue(app);

      const result = await controller.getApp('app-123');

      expect(result).toEqual(app);
      expect(mockAppRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'app-123' },
        relations: ['scopes', 'workflows', 'actions'],
      });
    });

    it('should throw NotFoundException if app not found', async () => {
      mockAppRepository.findOne.mockResolvedValue(null);

      await expect(controller.getApp('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('executeAction', () => {
    it('should execute an app action', async () => {
      const workflow = {
        id: 'workflow-123',
        name: 'Test Workflow',
      };

      const appWorkflow = {
        id: 'app-workflow-123',
        app_id: 'app-123',
        alias: 'test_flow',
        workflow_id: 'workflow-123',
        label: 'Test Flow',
        default_mode: 'draft',
        workflow: workflow,
      };

      const appAction = {
        id: 'action-123',
        app_id: 'app-123',
        action_id: 'test_action',
        label: 'Test Action',
        app_workflow_id: 'app-workflow-123',
        input_mapping: {
          hotel_id: '$context.hotel_id',
        },
        app_workflow: appWorkflow,
      };

      const run = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        status: 'pending',
      };

      mockAppActionRepository.findOne.mockResolvedValue(appAction);
      mockOrchestratorService.startRun.mockResolvedValue(run);

      const result = await controller.executeAction(
        'app-123',
        'test_action',
        {
          event: {},
          context: { hotel_id: 'hotel-1', tenant_id: 'tenant-1' },
        },
      );

      expect(result).toEqual({
        run_id: 'run-123',
        status: 'pending',
        workflow_id: 'workflow-123',
        app_id: 'app-123',
        app_action_id: 'test_action',
      });

      expect(mockOrchestratorService.startRun).toHaveBeenCalledWith(
        'workflow-123',
        { hotel_id: 'hotel-1' },
        'draft',
        'tenant-1',
        undefined,
        'app-123',
        'test_action',
      );
    });

    it('should throw NotFoundException if action not found', async () => {
      mockAppActionRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.executeAction('app-123', 'unknown', {
          event: {},
          context: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

