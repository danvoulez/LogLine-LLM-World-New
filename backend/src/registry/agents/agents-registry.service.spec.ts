import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AgentsRegistryService } from './agents-registry.service';
import { Agent } from '../../agents/entities/agent.entity';
import { AgentTrainingHistory } from './entities/agent-training-history.entity';
import { AgentEvaluation } from './entities/agent-evaluation.entity';
import { CreateAgentRegistryDto } from './dto/create-agent-registry.dto';
import { TrainAgentDto } from './dto/train-agent.dto';
import { EvaluateAgentDto } from './dto/evaluate-agent.dto';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { LogLineIdService } from '../common/logline-id.service';

describe('AgentsRegistryService', () => {
  let service: AgentsRegistryService;
  let agentRepository: Repository<Agent>;
  let trainingHistoryRepository: Repository<AgentTrainingHistory>;
  let evaluationRepository: Repository<AgentEvaluation>;
  let dataSource: DataSource;

  const mockAgentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTrainingHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockEvaluationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback({
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    })),
  };

  const mockLoglineIdService = {
    generateAgentId: jest.fn().mockResolvedValue('LL-AGENT-2024-000000001-B2'),
    extractBaseId: jest.fn((id) => id.split('-').slice(0, 4).join('-')),
    validateLogLineId: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsRegistryService,
        {
          provide: getRepositoryToken(Agent),
          useValue: mockAgentRepository,
        },
        {
          provide: getRepositoryToken(AgentTrainingHistory),
          useValue: mockTrainingHistoryRepository,
        },
        {
          provide: getRepositoryToken(AgentEvaluation),
          useValue: mockEvaluationRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: LogLineIdService,
          useValue: mockLoglineIdService,
        },
      ],
    }).compile();

    service = module.get<AgentsRegistryService>(AgentsRegistryService);
    agentRepository = module.get<Repository<Agent>>(getRepositoryToken(Agent));
    trainingHistoryRepository = module.get<Repository<AgentTrainingHistory>>(
      getRepositoryToken(AgentTrainingHistory),
    );
    evaluationRepository = module.get<Repository<AgentEvaluation>>(
      getRepositoryToken(AgentEvaluation),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new agent with LogLine Agent ID', async () => {
      const dto: CreateAgentRegistryDto = {
        id: 'agent.test',
        name: 'Test Agent',
        instructions: 'Test instructions',
        model_profile: { provider: 'openai', model: 'gpt-4o' },
        allowed_tools: ['tool1'],
        tenant_id: 'tenant-123',
      };

      const agent = {
        id: 'agent.test',
        logline_agent_id: 'LL-AGENT-2024-000000001',
        ...dto,
        onboarding_status: 'pending',
        memory_enabled: true,
        memory_scope: 'private',
        visibility: 'tenant',
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        accountability_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockAgentRepository.findOne.mockResolvedValue(null);
      mockAgentRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockAgentRepository.create.mockReturnValue(agent);
      mockAgentRepository.save.mockResolvedValue(agent);

      const result = await service.register(dto);

      expect(result.logline_agent_id).toMatch(/^LL-AGENT-\d{4}-\d{9}$/);
      expect(result.onboarding_status).toBe('pending');
    });

    it('should throw ConflictException if agent already exists', async () => {
      const dto: CreateAgentRegistryDto = {
        id: 'agent.test',
        name: 'Test Agent',
        instructions: 'Test',
        model_profile: { provider: 'openai', model: 'gpt-4o' },
        allowed_tools: [],
      };

      mockAgentRepository.findOne.mockResolvedValue({ id: 'agent.test' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('train', () => {
    it('should start training for an agent', async () => {
      const agent = {
        id: 'agent.test',
        onboarding_status: 'pending',
        training_type: null,
        training_data: null,
      };

      const trainDto: TrainAgentDto = {
        training_type: 'personalized',
        training_data: { dataset: ['example1'] },
      };

      const training = {
        id: 'training-123',
        agent_id: 'agent.test',
        training_type: 'personalized',
        training_data: trainDto.training_data,
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockAgentRepository.save.mockResolvedValue({
        ...agent,
        onboarding_status: 'in_training',
        training_type: 'personalized',
      });
      mockTrainingHistoryRepository.create.mockReturnValue(training);
      mockTrainingHistoryRepository.save.mockResolvedValue(training);

      const manager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(manager);
      });

      const result = await service.train('agent.test', trainDto);

      expect(result.agent.onboarding_status).toBe('in_training');
      expect(result.training.training_type).toBe('personalized');
    });
  });

  describe('completeTraining', () => {
    it('should complete training successfully', async () => {
      const agent = {
        id: 'agent.test',
        onboarding_status: 'in_training',
        training_completed_at: null,
      };

      const latestTraining = {
        id: 'training-123',
        agent_id: 'agent.test',
        result: null,
        performance_metrics: null,
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockTrainingHistoryRepository.findOne.mockResolvedValue(latestTraining);
      mockTrainingHistoryRepository.save.mockResolvedValue({
        ...latestTraining,
        result: 'success',
      });
      mockAgentRepository.save.mockResolvedValue({
        ...agent,
        onboarding_status: 'trained',
        training_completed_at: expect.any(Date),
      });

      const result = await service.completeTraining('agent.test', 'success');

      expect(result.onboarding_status).toBe('trained');
      expect(result.training_completed_at).toBeDefined();
    });

    it('should throw BadRequestException if agent not in training', async () => {
      const agent = {
        id: 'agent.test',
        onboarding_status: 'trained',
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);

      await expect(
        service.completeTraining('agent.test', 'success'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('certify', () => {
    it('should certify a trained agent', async () => {
      const agent = {
        id: 'agent.test',
        onboarding_status: 'trained',
        certified_by_logline_id: null,
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockAgentRepository.save.mockResolvedValue({
        ...agent,
        onboarding_status: 'certified',
        certified_by_logline_id: 'LL-BR-2024-000000001',
      });

      const result = await service.certify(
        'agent.test',
        'LL-BR-2024-000000001',
      );

      expect(result.onboarding_status).toBe('certified');
      expect(result.certified_by_logline_id).toBe('LL-BR-2024-000000001');
    });

    it('should throw BadRequestException if agent not trained', async () => {
      const agent = {
        id: 'agent.test',
        onboarding_status: 'pending',
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);

      await expect(
        service.certify('agent.test', 'LL-BR-2024-000000001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignContract', () => {
    it('should assign contract to agent', async () => {
      const agent = {
        id: 'agent.test',
        active_contract_id: null,
        contract_scope: null,
      };

      const contractScope = {
        allowed_tools: ['tool1', 'tool2'],
        max_cost_per_run_cents: 1000,
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockAgentRepository.save.mockResolvedValue({
        ...agent,
        active_contract_id: 'contract-123',
        contract_scope: contractScope,
      });

      const result = await service.assignContract(
        'agent.test',
        'contract-123',
        contractScope,
      );

      expect(result.active_contract_id).toBe('contract-123');
      expect(result.contract_scope).toEqual(contractScope);
    });
  });

  describe('evaluate', () => {
    it('should evaluate agent and update reputation', async () => {
      const agent = {
        id: 'agent.test',
        reputation_score: null,
      };

      const evaluationDto: EvaluateAgentDto = {
        rating: 5,
        evaluation: 'Excellent agent',
        criteria: { accuracy: 5, speed: 4 },
      };

      const existingEvaluations = [
        { rating: 4 },
        { rating: 5 },
      ];

      const newEvaluation = {
        id: 'eval-123',
        agent_id: 'agent.test',
        evaluator_logline_id: 'LL-BR-2024-000000001',
        ...evaluationDto,
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockEvaluationRepository.find.mockResolvedValue(existingEvaluations);
      mockEvaluationRepository.create.mockReturnValue(newEvaluation);

      const manager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(manager);
      });

      const result = await service.evaluate(
        'agent.test',
        'LL-BR-2024-000000001',
        evaluationDto,
      );

      expect(result.evaluation.rating).toBe(5);
      expect(result.agent.reputation_score).toBeDefined();
    });
  });
});

