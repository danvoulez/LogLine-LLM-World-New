import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentsController } from './agents.controller';
import { AgentRuntimeService } from './agent-runtime.service';
import { Agent } from './entities/agent.entity';
import { Run } from '../runs/entities/run.entity';
import { Step } from '../runs/entities/step.entity';
import { Event } from '../runs/entities/event.entity';
import { NotFoundException } from '@nestjs/common';

describe('AgentsController', () => {
  let controller: AgentsController;
  let agentRepository: Repository<Agent>;
  let runRepository: Repository<Run>;
  let stepRepository: Repository<Step>;
  let eventRepository: Repository<Event>;
  let agentRuntime: AgentRuntimeService;

  const mockAgentRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRunRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockStepRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  const mockAgentRuntime = {
    getAgent: jest.fn(),
    runAgentStep: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [
        {
          provide: getRepositoryToken(Agent),
          useValue: mockAgentRepository,
        },
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: getRepositoryToken(Step),
          useValue: mockStepRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: AgentRuntimeService,
          useValue: mockAgentRuntime,
        },
      ],
    }).compile();

    controller = module.get<AgentsController>(AgentsController);
    agentRepository = module.get<Repository<Agent>>(getRepositoryToken(Agent));
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
    stepRepository = module.get<Repository<Step>>(getRepositoryToken(Step));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    agentRuntime = module.get<AgentRuntimeService>(AgentRuntimeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all agents', async () => {
      const agents = [
        { id: 'agent1', name: 'Agent 1' },
        { id: 'agent2', name: 'Agent 2' },
      ];

      mockAgentRepository.find.mockResolvedValue(agents);

      const result = await controller.findAll();

      expect(result).toEqual(agents);
      expect(mockAgentRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an agent', async () => {
      const agent = { id: 'agent1', name: 'Agent 1' };

      mockAgentRuntime.getAgent.mockResolvedValue(agent);

      const result = await controller.findOne('agent1');

      expect(result).toEqual(agent);
      expect(mockAgentRuntime.getAgent).toHaveBeenCalledWith('agent1');
    });

    it('should throw NotFoundException if agent not found', async () => {
      mockAgentRuntime.getAgent.mockResolvedValue(null);

      await expect(controller.findOne('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create an agent', async () => {
      const createDto = {
        id: 'agent1',
        name: 'Agent 1',
        instructions: 'Test instructions',
        model_profile: { provider: 'openai', model: 'gpt-4o-mini' },
        allowed_tools: [],
      };

      const savedAgent = { ...createDto, created_at: new Date() };

      mockAgentRepository.create.mockReturnValue(createDto);
      mockAgentRepository.save.mockResolvedValue(savedAgent);

      const result = await controller.create(createDto);

      expect(result).toEqual(savedAgent);
      expect(mockAgentRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockAgentRepository.save).toHaveBeenCalledWith(createDto);
    });
  });

  describe('conversation', () => {
    it('should handle conversation request', async () => {
      const agent = {
        id: 'agent1',
        name: 'Test Agent',
        instructions: 'Test',
        model_profile: { provider: 'openai', model: 'gpt-4o-mini' },
        allowed_tools: [],
      };

      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      const run = {
        id: 'run-123',
        workflow_id: 'conversation',
        workflow_version: '1.0.0',
        status: 'running',
        mode: 'draft',
        input: { message: 'Hello' },
        tenant_id: 'tenant-1',
        user_id: null,
        app_id: null,
        app_action_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const step = {
        id: 'step-123',
        run_id: 'run-123',
        node_id: 'conversation',
        type: 'agent',
        status: 'running',
        input: { message: 'Hello' },
        started_at: new Date(),
      };

      const agentResult = {
        text: 'Hello! How can I help you?',
        toolCalls: [],
        finishReason: 'stop',
      };

      mockAgentRuntime.getAgent.mockResolvedValue(agent);
      mockRunRepository.create.mockReturnValue(run);
      mockRunRepository.save.mockResolvedValue(run);
      mockStepRepository.create.mockReturnValue(step);
      mockStepRepository.save.mockResolvedValue(step);
      mockEventRepository.save.mockResolvedValue({});
      mockAgentRuntime.runAgentStep.mockResolvedValue(agentResult);

      await controller.conversation(
        'agent1',
        { message: 'Hello', tenant_id: 'tenant-1' },
        mockRes as any,
      );

      expect(mockAgentRuntime.getAgent).toHaveBeenCalledWith('agent1');
      expect(mockRunRepository.create).toHaveBeenCalled();
      expect(mockStepRepository.create).toHaveBeenCalled();
      expect(mockAgentRuntime.runAgentStep).toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle agent not found', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      mockAgentRuntime.getAgent.mockResolvedValue(null);

      await controller.conversation(
        'unknown',
        { message: 'Hello' },
        mockRes as any,
      );

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('error'),
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});

