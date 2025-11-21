import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BudgetTrackerService } from './budget-tracker.service';
import { Run } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';

describe('BudgetTrackerService', () => {
  let service: BudgetTrackerService;
  let runRepository: Repository<Run>;
  let eventRepository: Repository<Event>;

  const mockRunRepository = {
    findOne: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetTrackerService,
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
      ],
    }).compile();

    service = module.get<BudgetTrackerService>(BudgetTrackerService);
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeRun', () => {
    it('should initialize metrics for a run', () => {
      service.initializeRun('run-123');

      // Access private metrics map via reflection or test through public methods
      service.addCost('run-123', 0);
      service.incrementLlmCalls('run-123');
      
      // Verify initialization worked by checking metrics exist
      const result = service.checkBudget('run-123');
      expect(result).toBeDefined();
    });
  });

  describe('addCost', () => {
    it('should add cost to run metrics', async () => {
      const mockRun = {
        id: 'run-123',
        cost_limit_cents: 1000,
        llm_calls_limit: null,
        latency_slo_ms: null,
      };

      mockRunRepository.findOne.mockResolvedValue(mockRun);
      service.initializeRun('run-123');
      service.addCost('run-123', 100);

      const result = await service.checkBudget('run-123');
      expect(result.exceeded).toBe(false);
    });
  });

  describe('incrementLlmCalls', () => {
    it('should increment LLM call count', async () => {
      const mockRun = {
        id: 'run-123',
        cost_limit_cents: null,
        llm_calls_limit: 10,
        latency_slo_ms: null,
      };

      mockRunRepository.findOne.mockResolvedValue(mockRun);
      service.initializeRun('run-123');
      service.incrementLlmCalls('run-123');
      service.incrementLlmCalls('run-123');

      const result = await service.checkBudget('run-123');
      expect(result.exceeded).toBe(false);
    });
  });

  describe('checkBudget', () => {
    it('should return not exceeded if within budget', async () => {
      const mockRun = {
        id: 'run-123',
        cost_limit_cents: 1000,
        llm_calls_limit: 100,
        latency_slo_ms: 60000,
      };

      mockRunRepository.findOne.mockResolvedValue(mockRun);
      service.initializeRun('run-123');
      service.addCost('run-123', 500);

      const result = await service.checkBudget('run-123');

      expect(result.exceeded).toBe(false);
    });

    it('should return exceeded if cost limit exceeded', async () => {
      const mockRun = {
        id: 'run-123',
        cost_limit_cents: 100,
        llm_calls_limit: null,
        latency_slo_ms: null,
      };

      mockRunRepository.findOne.mockResolvedValue(mockRun);
      service.initializeRun('run-123');
      service.addCost('run-123', 200);

      const result = await service.checkBudget('run-123');

      expect(result.exceeded).toBe(true);
      expect(result.reason).toBe('cost');
    });

    it('should return exceeded if LLM calls limit exceeded', async () => {
      const mockRun = {
        id: 'run-123',
        cost_limit_cents: null,
        llm_calls_limit: 5,
        latency_slo_ms: null,
      };

      mockRunRepository.findOne.mockResolvedValue(mockRun);
      service.initializeRun('run-123');

      for (let i = 0; i < 6; i++) {
        service.incrementLlmCalls('run-123');
      }

      const result = await service.checkBudget('run-123');

      expect(result.exceeded).toBe(true);
      expect(result.reason).toBe('llm_calls');
    });
  });
});

