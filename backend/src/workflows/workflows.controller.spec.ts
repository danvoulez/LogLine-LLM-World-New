import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WorkflowsController', () => {
  let controller: WorkflowsController;
  let workflowsService: WorkflowsService;

  const mockWorkflowsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: mockWorkflowsService,
        },
        {
          provide: getRepositoryToken(Workflow),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<WorkflowsController>(WorkflowsController);
    workflowsService = module.get<WorkflowsService>(WorkflowsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      const createDto = {
        name: 'Test Workflow',
        definition: {
          nodes: [{ id: 'start', type: 'static' }],
          edges: [],
        },
      };

      const mockWorkflow = {
        id: 'workflow-123',
        ...createDto,
        version: 1,
      };

      mockWorkflowsService.create.mockResolvedValue(mockWorkflow);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockWorkflow);
      expect(mockWorkflowsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all workflows', async () => {
      const mockWorkflows = [
        { id: 'workflow-1', name: 'Workflow 1' },
        { id: 'workflow-2', name: 'Workflow 2' },
      ];

      mockWorkflowsService.findAll.mockResolvedValue(mockWorkflows);

      const result = await controller.findAll();

      expect(result).toEqual(mockWorkflows);
      expect(mockWorkflowsService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a workflow by id', async () => {
      const mockWorkflow = { id: 'workflow-123', name: 'Test Workflow' };

      mockWorkflowsService.findOne.mockResolvedValue(mockWorkflow);

      const result = await controller.findOne('workflow-123');

      expect(result).toEqual(mockWorkflow);
      expect(mockWorkflowsService.findOne).toHaveBeenCalledWith('workflow-123');
    });
  });

  describe('update', () => {
    it('should update a workflow', async () => {
      const updateDto = { name: 'Updated Workflow' };
      const mockWorkflow = { id: 'workflow-123', name: 'Updated Workflow' };

      mockWorkflowsService.update.mockResolvedValue(mockWorkflow);

      const result = await controller.update('workflow-123', updateDto);

      expect(result).toEqual(mockWorkflow);
      expect(mockWorkflowsService.update).toHaveBeenCalledWith('workflow-123', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a workflow', async () => {
      mockWorkflowsService.remove.mockResolvedValue(undefined);

      await controller.remove('workflow-123');

      expect(mockWorkflowsService.remove).toHaveBeenCalledWith('workflow-123');
    });
  });
});

