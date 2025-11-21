import { Test, TestingModule } from '@nestjs/testing';
import { ToolsController } from './tools.controller';
import { ToolRuntimeService } from './tool-runtime.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { NotFoundException } from '@nestjs/common';

describe('ToolsController', () => {
  let controller: ToolsController;
  let toolRuntime: ToolRuntimeService;
  let toolRepository: Repository<Tool>;

  const mockToolRuntime = {
    getAllTools: jest.fn(),
    getTool: jest.fn(),
  };

  const mockToolRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolsController],
      providers: [
        {
          provide: ToolRuntimeService,
          useValue: mockToolRuntime,
        },
        {
          provide: getRepositoryToken(Tool),
          useValue: mockToolRepository,
        },
      ],
    }).compile();

    controller = module.get<ToolsController>(ToolsController);
    toolRuntime = module.get<ToolRuntimeService>(ToolRuntimeService);
    toolRepository = module.get<Repository<Tool>>(getRepositoryToken(Tool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a tool', async () => {
      const createDto = {
        id: 'test-tool',
        name: 'Test Tool',
        description: 'A test tool',
      };

      const mockTool = {
        id: 'test-tool',
        ...createDto,
      };

      mockToolRepository.create.mockReturnValue(mockTool);
      mockToolRepository.save.mockResolvedValue(mockTool);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockTool);
      expect(mockToolRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockToolRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all tools', async () => {
      const mockTools = [
        { id: 'tool-1', name: 'Tool 1' },
        { id: 'tool-2', name: 'Tool 2' },
      ];

      mockToolRuntime.getAllTools.mockResolvedValue(mockTools);

      const result = await controller.findAll();

      expect(result).toEqual(mockTools);
      expect(mockToolRuntime.getAllTools).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a tool by id', async () => {
      const mockTool = { id: 'tool-1', name: 'Tool 1' };

      mockToolRuntime.getTool.mockResolvedValue(mockTool);

      const result = await controller.findOne('tool-1');

      expect(result).toEqual(mockTool);
      expect(mockToolRuntime.getTool).toHaveBeenCalledWith('tool-1');
    });

    it('should throw NotFoundException if tool not found', async () => {
      mockToolRuntime.getTool.mockResolvedValue(null);

      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});

