import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricsService } from './metrics.service';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Step, StepStatus } from '../runs/entities/step.entity';

describe('MetricsService', () => {
  let service: MetricsService;
  let runRepository: Repository<Run>;
  let eventRepository: Repository<Event>;
  let stepRepository: Repository<Step>;

  const mockRunRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  const mockEventRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockStepRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(Step),
          useValue: mockStepRepository,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    stepRepository = module.get<Repository<Step>>(getRepositoryToken(Step));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetricsSnapshot', () => {
    it('should return metrics snapshot', async () => {
      mockRunRepository.count.mockResolvedValue(10);
      mockRunRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'completed', count: '5' },
          { status: 'failed', count: '2' },
        ]),
      });

      const mockEventQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            kind: EventKind.LLM_CALL,
            payload: { usage: { promptTokens: 100, completionTokens: 50 }, estimated_cost_cents: 10 },
            ts: new Date(),
          },
        ]),
      };

      mockEventRepository.createQueryBuilder.mockReturnValue(mockEventQueryBuilder as any);
      mockRunRepository.find.mockResolvedValue([]);
      mockStepRepository.find.mockResolvedValue([]);

      const result = await service.getMetricsSnapshot();

      expect(result).toBeDefined();
      expect(result.runs.total).toBe(10);
      expect(result.llm.calls_total).toBe(1);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getPrometheusMetrics', () => {
    it('should return Prometheus format metrics', async () => {
      mockRunRepository.count.mockResolvedValue(10);
      mockRunRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      const mockEventQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockEventRepository.createQueryBuilder.mockReturnValue(mockEventQueryBuilder as any);
      mockRunRepository.find.mockResolvedValue([]);
      mockStepRepository.find.mockResolvedValue([]);

      const result = await service.getPrometheusMetrics();

      expect(result).toBeDefined();
      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
      expect(result).toContain('runs_total');
    });
  });
});

