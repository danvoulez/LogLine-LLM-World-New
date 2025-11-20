import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentRuntimeService } from './agent-runtime.service';
import { Agent } from './entities/agent.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Event } from '../runs/entities/event.entity';
import { Step } from '../runs/entities/step.entity';
import { Run } from '../runs/entities/run.entity';
import { LlmRouterService } from '../llm/llm-router.service';
import { ToolRuntimeService } from '../tools/tool-runtime.service';
import { ContextSummarizerService } from './context-summarizer.service';
import { AtomicEventConverterService } from './atomic-event-converter.service';
import { NotFoundException } from '@nestjs/common';

describe('AgentRuntimeService', () => {
  let service: AgentRuntimeService;
  let agentRepository: Repository<Agent>;
  let toolRepository: Repository<Tool>;
  let eventRepository: Repository<Event>;

  const mockAgentRepository = {
    findOne: jest.fn(),
  };

  const mockToolRepository = {
    findOne: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  const mockStepRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };

  const mockRunRepository = {
    findOne: jest.fn().mockResolvedValue(null),
  };

  const mockLlmRouter = {
    generateText: jest.fn().mockResolvedValue({
      text: 'Agent response',
      toolCalls: [],
      finishReason: 'stop',
    }),
  };

  const mockToolRuntime = {
    callTool: jest.fn().mockResolvedValue({ result: 'Tool result' }),
  };

  const mockContextSummarizer = {
    buildConversationalContext: jest.fn().mockReturnValue('Context summary'),
    summarizeWorkflowInput: jest.fn().mockReturnValue('Input summary'),
  };

  const mockAtomicConverter = {
    buildAtomicContextChain: jest.fn().mockReturnValue({
      run_id: 'run-123',
      steps: [],
      events: [],
    }),
    formatAtomicContextForLLM: jest.fn().mockReturnValue('Atomic context'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRuntimeService,
        {
          provide: getRepositoryToken(Agent),
          useValue: mockAgentRepository,
        },
        {
          provide: getRepositoryToken(Tool),
          useValue: mockToolRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: getRepositoryToken(Step),
          useValue: mockStepRepository,
        },
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: LlmRouterService,
          useValue: mockLlmRouter,
        },
        {
          provide: ToolRuntimeService,
          useValue: mockToolRuntime,
        },
        {
          provide: ContextSummarizerService,
          useValue: mockContextSummarizer,
        },
        {
          provide: AtomicEventConverterService,
          useValue: mockAtomicConverter,
        },
      ],
    }).compile();

    service = module.get<AgentRuntimeService>(AgentRuntimeService);
    agentRepository = module.get<Repository<Agent>>(getRepositoryToken(Agent));
    toolRepository = module.get<Repository<Tool>>(getRepositoryToken(Tool));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runAgentStep', () => {
    const context = {
      runId: 'run-123',
      stepId: 'step-123',
      tenantId: 'tenant-1',
    };

    it('should run agent step successfully', async () => {
      const agent = {
        id: 'agent.test',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant',
        model_profile: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
        allowed_tools: [],
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockEventRepository.save.mockResolvedValue({});

      const result = await service.runAgentStep('agent.test', context);

      expect(result).toHaveProperty('text');
      expect(result.text).toBe('Agent response');
      expect(mockLlmRouter.generateText).toHaveBeenCalled();
      expect(mockEventRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if agent not found', async () => {
      mockAgentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.runAgentStep('unknown-agent', context),
      ).rejects.toThrow(NotFoundException);
    });

    it('should load and use allowed tools', async () => {
      const agent = {
        id: 'agent.test',
        name: 'Test Agent',
        instructions: 'You are helpful',
        model_profile: {
          provider: 'openai',
          model: 'gpt-4o-mini',
        },
        allowed_tools: ['tool1'],
      };

      const tool = {
        id: 'tool1',
        name: 'Test Tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);
      mockToolRepository.findOne.mockResolvedValue(tool);
      mockEventRepository.save.mockResolvedValue({});

      await service.runAgentStep('agent.test', context);

      expect(mockToolRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tool1' },
      });
      expect(mockLlmRouter.generateText).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          tool1: expect.anything(),
        }),
      );
    });
  });

  describe('getAgent', () => {
    it('should return agent if found', async () => {
      const agent = {
        id: 'agent.test',
        name: 'Test Agent',
      };

      mockAgentRepository.findOne.mockResolvedValue(agent);

      const result = await service.getAgent('agent.test');

      expect(result).toEqual(agent);
      expect(mockAgentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'agent.test' },
      });
    });

    it('should return null if agent not found', async () => {
      mockAgentRepository.findOne.mockResolvedValue(null);

      const result = await service.getAgent('unknown-agent');

      expect(result).toBeNull();
    });
  });
});

