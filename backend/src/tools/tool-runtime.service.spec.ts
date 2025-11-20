import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolRuntimeService } from './tool-runtime.service';
import { Tool } from './entities/tool.entity';
import { Event } from '../runs/entities/event.entity';
import { NaturalLanguageDbTool } from './natural-language-db.tool';
import { NotFoundException } from '@nestjs/common';
import { RunsService } from '../runs/runs.service';

describe('ToolRuntimeService', () => {
  let service: ToolRuntimeService;
  let toolRepository: Repository<Tool>;
  let eventRepository: Repository<Event>;

  const mockToolRepository = {
    findOne: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  const mockNaturalLanguageDbTool = {
    createReadTool: jest.fn(),
    createWriteTool: jest.fn(),
  };

  const mockRunsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRuntimeService,
        {
          provide: getRepositoryToken(Tool),
          useValue: mockToolRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: NaturalLanguageDbTool,
          useValue: mockNaturalLanguageDbTool,
        },
        {
          provide: RunsService,
          useValue: mockRunsService,
        },
      ],
    }).compile();

    service = module.get<ToolRuntimeService>(ToolRuntimeService);
    toolRepository = module.get<Repository<Tool>>(getRepositoryToken(Tool));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('callTool', () => {
    const context = {
      runId: 'run-123',
      stepId: 'step-123',
      tenantId: 'tenant-1',
    };

    it('should call a registered tool', async () => {
      const tool = {
        id: 'ticketing.list_open',
        name: 'List Open Tickets',
        description: 'List open tickets',
        input_schema: {},
      };

      mockToolRepository.findOne.mockResolvedValue(tool);
      mockEventRepository.save.mockResolvedValue({});

      const result = await service.callTool('ticketing.list_open', {}, context);

      expect(result).toHaveProperty('tickets');
      expect(mockToolRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ticketing.list_open' },
      });
      expect(mockEventRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if tool not found', async () => {
      mockToolRepository.findOne.mockResolvedValue(null);

      await expect(
        service.callTool('unknown-tool', {}, context),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if handler not registered', async () => {
      const tool = {
        id: 'unknown-tool',
        name: 'Unknown Tool',
        description: 'Unknown',
        input_schema: {},
      };

      mockToolRepository.findOne.mockResolvedValue(tool);

      await expect(
        service.callTool('unknown-tool', {}, context),
      ).rejects.toThrow('No handler registered for tool');
    });

    it('should log error event on tool execution failure', async () => {
      const tool = {
        id: 'ticketing.list_open',
        name: 'List Open Tickets',
        description: 'List open tickets',
        input_schema: {},
      };

      mockToolRepository.findOne.mockResolvedValue(tool);
      
      // Register a tool that throws
      service.registerTool('test-error-tool', async () => {
        throw new Error('Tool execution failed');
      });

      const testTool = {
        id: 'test-error-tool',
        name: 'Test Error Tool',
        description: 'Test',
        input_schema: {},
      };

      mockToolRepository.findOne.mockResolvedValue(testTool);

      await expect(
        service.callTool('test-error-tool', {}, context),
      ).rejects.toThrow('Tool execution failed');

      expect(mockEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'tool_call',
          payload: expect.objectContaining({
            error: 'Tool execution failed',
          }),
        }),
      );
    });
  });

  describe('getTool', () => {
    it('should return tool if found', async () => {
      const tool = {
        id: 'test-tool',
        name: 'Test Tool',
      };

      mockToolRepository.findOne.mockResolvedValue(tool);

      const result = await service.getTool('test-tool');

      expect(result).toEqual(tool);
      expect(mockToolRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-tool' },
      });
    });

    it('should return null if tool not found', async () => {
      mockToolRepository.findOne.mockResolvedValue(null);

      const result = await service.getTool('unknown-tool');

      expect(result).toBeNull();
    });
  });
});

