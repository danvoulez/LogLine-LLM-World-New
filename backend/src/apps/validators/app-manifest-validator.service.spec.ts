import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppManifestValidatorService } from './app-manifest-validator.service';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { WorkflowValidationException } from '../../common/exceptions/workflow-validation.exception';

describe('AppManifestValidatorService', () => {
  let service: AppManifestValidatorService;
  let workflowRepository: Repository<Workflow>;
  let toolRepository: Repository<Tool>;

  const mockWorkflowRepository = {
    findOne: jest.fn(),
  };

  const mockToolRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppManifestValidatorService,
        {
          provide: getRepositoryToken(Workflow),
          useValue: mockWorkflowRepository,
        },
        {
          provide: getRepositoryToken(Tool),
          useValue: mockToolRepository,
        },
      ],
    }).compile();

    service = module.get<AppManifestValidatorService>(
      AppManifestValidatorService,
    );
    workflowRepository = module.get<Repository<Workflow>>(
      getRepositoryToken(Workflow),
    );
    toolRepository = module.get<Repository<Tool>>(getRepositoryToken(Tool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should throw if manifest is null', async () => {
      await expect(service.validate(null as any)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if version is missing', async () => {
      const manifest = { app: { id: 'test', name: 'Test' } };
      await expect(service.validate(manifest as any)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if version is not 1.0.0', async () => {
      const manifest = {
        version: '2.0.0',
        app: { id: 'test', name: 'Test' },
      };
      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if app object is missing', async () => {
      const manifest = { version: '1.0.0' };
      await expect(service.validate(manifest as any)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if app.id is missing', async () => {
      const manifest = {
        version: '1.0.0',
        app: { name: 'Test' },
      };
      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if app.name is missing', async () => {
      const manifest = {
        version: '1.0.0',
        app: { id: 'test' },
      };
      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if tool in scopes does not exist', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test',
          name: 'Test',
          scopes: {
            tools: ['nonexistent-tool'],
          },
        },
      };

      mockToolRepository.find.mockResolvedValue([]);

      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should pass if tool in scopes exists', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test',
          name: 'Test',
          scopes: {
            tools: ['natural_language_db_read'],
          },
        },
      };

      mockToolRepository.find.mockResolvedValue([
        { id: 'natural_language_db_read' },
      ]);

      await expect(service.validate(manifest)).resolves.not.toThrow();
    });

    it('should throw if workflow_ref does not exist', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test',
          name: 'Test',
          workflows: [
            {
              id: 'wf-alias',
              workflow_ref: 'nonexistent-workflow',
              label: 'Workflow',
            },
          ],
        },
      };

      mockWorkflowRepository.findOne.mockResolvedValue(null);

      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if action references non-existent workflow alias', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test',
          name: 'Test',
          workflows: [
            {
              id: 'wf-alias',
              workflow_ref: 'workflow-id',
              label: 'Workflow',
            },
          ],
          actions: [
            {
              id: 'action-1',
              label: 'Action',
              workflow_id: 'nonexistent-alias',
              input_mapping: {},
            },
          ],
        },
      };

      mockWorkflowRepository.findOne.mockResolvedValue({ id: 'workflow-id' });

      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if duplicate workflow alias', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test',
          name: 'Test',
          workflows: [
            {
              id: 'duplicate',
              workflow_ref: 'workflow-1',
              label: 'Workflow 1',
            },
            {
              id: 'duplicate',
              workflow_ref: 'workflow-2',
              label: 'Workflow 2',
            },
          ],
        },
      };

      mockWorkflowRepository.findOne.mockResolvedValue({ id: 'workflow-1' });

      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should throw if duplicate action ID', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test',
          name: 'Test',
          workflows: [
            {
              id: 'wf-alias',
              workflow_ref: 'workflow-id',
              label: 'Workflow',
            },
          ],
          actions: [
            {
              id: 'duplicate',
              label: 'Action 1',
              workflow_id: 'wf-alias',
              input_mapping: {},
            },
            {
              id: 'duplicate',
              label: 'Action 2',
              workflow_id: 'wf-alias',
              input_mapping: {},
            },
          ],
        },
      };

      mockWorkflowRepository.findOne.mockResolvedValue({ id: 'workflow-id' });

      await expect(service.validate(manifest)).rejects.toThrow(
        WorkflowValidationException,
      );
    });

    it('should validate a valid manifest', async () => {
      const manifest = {
        version: '1.0.0',
        app: {
          id: 'test-app',
          name: 'Test App',
          description: 'A test app',
          visibility: 'private',
          scopes: {
            tools: ['natural_language_db_read'],
            memory: ['memory-1'],
          },
          workflows: [
            {
              id: 'wf-alias',
              workflow_ref: 'workflow-id',
              label: 'Test Workflow',
              default_mode: 'draft',
            },
          ],
          actions: [
            {
              id: 'action-1',
              label: 'Test Action',
              workflow_id: 'wf-alias',
              input_mapping: {
                query: '$context.query',
              },
            },
          ],
        },
      };

      mockToolRepository.find.mockResolvedValue([
        { id: 'natural_language_db_read' },
      ]);
      mockWorkflowRepository.findOne.mockResolvedValue({ id: 'workflow-id' });

      await expect(service.validate(manifest)).resolves.not.toThrow();
    });
  });
});

