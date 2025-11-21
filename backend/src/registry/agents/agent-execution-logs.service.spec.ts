import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentExecutionLogsService } from './agent-execution-logs.service';
import { AgentExecutionLog } from './entities/agent-execution-log.entity';
import { CreateExecutionLogDto } from './dto/create-execution-log.dto';
import { NotFoundException } from '@nestjs/common';

describe('AgentExecutionLogsService', () => {
  let service: AgentExecutionLogsService;
  let logRepository: Repository<AgentExecutionLog>;

  const mockLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutionLogsService,
        {
          provide: getRepositoryToken(AgentExecutionLog),
          useValue: mockLogRepository,
        },
      ],
    }).compile();

    service = module.get<AgentExecutionLogsService>(AgentExecutionLogsService);
    logRepository = module.get<Repository<AgentExecutionLog>>(
      getRepositoryToken(AgentExecutionLog),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new execution log', async () => {
      const dto: CreateExecutionLogDto = {
        agent_id: 'agent-123',
        execution_id: 'exec-123',
        started_at: '2024-01-01T10:00:00Z',
        status: 'running',
      };

      const log = {
        id: 'log-123',
        ...dto,
        started_at: new Date(dto.started_at),
        created_at: new Date(),
      };

      mockLogRepository.create.mockReturnValue(log);
      mockLogRepository.save.mockResolvedValue(log);

      const result = await service.create(dto);

      expect(result).toEqual(log);
      expect(mockLogRepository.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update an execution log', async () => {
      const logId = 'log-123';
      const updates = {
        status: 'success' as const,
        finished_at: new Date(),
        cost_cents: 50,
      };

      const existingLog = {
        id: logId,
        status: 'running',
        started_at: new Date(),
      };

      mockLogRepository.findOne.mockResolvedValue(existingLog);
      mockLogRepository.save.mockResolvedValue({ ...existingLog, ...updates });

      const result = await service.update(logId, updates);

      expect(result.status).toBe('success');
      expect(result.cost_cents).toBe(50);
    });

    it('should throw NotFoundException if log not found', async () => {
      mockLogRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('log-123', { status: 'failed' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getExecutionStats', () => {
    it('should calculate statistics correctly', async () => {
      const logs = [
        {
          status: 'success',
          cost_cents: 100,
          total_steps: 5,
          tools_used: ['tool-a', 'tool-b'],
          started_at: new Date('2024-01-01T10:00:00Z'),
        },
        {
          status: 'failed',
          cost_cents: 50,
          total_steps: 2,
          tools_used: ['tool-a'],
          started_at: new Date('2024-01-01T11:00:00Z'),
        },
        {
          status: 'success',
          cost_cents: 150,
          total_steps: 8,
          tools_used: ['tool-c'],
          started_at: new Date('2024-01-01T12:00:00Z'),
        },
      ];

      mockLogRepository.find.mockResolvedValue(logs);

      const stats = await service.getExecutionStats('agent-123', 'day');

      expect(stats.total_executions).toBe(3);
      expect(stats.successful_executions).toBe(2);
      expect(stats.failed_executions).toBe(1);
      expect(stats.success_rate).toBeCloseTo(66.67);
      expect(stats.total_cost_cents).toBe(300);
      expect(stats.avg_cost_cents).toBe(100);
      expect(stats.avg_steps).toBe(5);
      
      // Check most used tools
      expect(stats.most_used_tools).toEqual(
        expect.arrayContaining([
          { tool_id: 'tool-a', count: 2 },
          { tool_id: 'tool-b', count: 1 },
          { tool_id: 'tool-c', count: 1 },
        ])
      );
    });

    it('should handle empty logs gracefully', async () => {
      mockLogRepository.find.mockResolvedValue([]);

      const stats = await service.getExecutionStats('agent-123', 'day');

      expect(stats.total_executions).toBe(0);
      expect(stats.avg_cost_cents).toBe(0);
      expect(stats.success_rate).toBe(0);
    });
  });
});

