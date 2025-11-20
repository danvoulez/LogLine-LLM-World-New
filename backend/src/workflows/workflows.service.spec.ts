import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowsService } from './workflows.service';
import { Workflow } from './entities/workflow.entity';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { NotFoundException } from '@nestjs/common';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let repository: Repository<Workflow>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        {
          provide: getRepositoryToken(Workflow),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
    repository = module.get<Repository<Workflow>>(getRepositoryToken(Workflow));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      const createDto: CreateWorkflowDto = {
        name: 'Test Workflow',
        definition: {
          nodes: [{ id: 'node1', type: 'static' }],
          edges: [],
          entryNode: 'node1',
        },
      };

      const workflow = {
        id: '123',
        ...createDto,
        version: '1.0.0',
        type: 'linear',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.create.mockReturnValue(workflow);
      mockRepository.save.mockResolvedValue(workflow);

      const result = await service.create(createDto);

      expect(result).toEqual(workflow);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        version: '1.0.0',
        type: 'linear',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(workflow);
    });
  });

  describe('findOne', () => {
    it('should return a workflow', async () => {
      const workflow = {
        id: '123',
        name: 'Test Workflow',
        version: '1.0.0',
        definition: { nodes: [], edges: [], entryNode: 'node1' },
        type: 'linear',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(workflow);

      const result = await service.findOne('123');

      expect(result).toEqual(workflow);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated workflows', async () => {
      const workflows = [
        {
          id: '123',
          name: 'Test Workflow',
          version: '1.0.0',
          definition: { nodes: [], edges: [], entryNode: 'node1' },
          type: 'linear',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([workflows, 1]);

      const result = await service.findAll(1, 10);

      expect(result.data).toEqual(workflows);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});

