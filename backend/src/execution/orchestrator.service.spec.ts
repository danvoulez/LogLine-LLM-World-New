import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrchestratorService } from './orchestrator.service';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Run } from '../runs/entities/run.entity';
import { Step } from '../runs/entities/step.entity';
import { Event } from '../runs/entities/event.entity';
import { NotFoundException } from '@nestjs/common';
import { AgentRuntimeService } from '../agents/agent-runtime.service';
import { ToolRuntimeService } from '../tools/tool-runtime.service';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let workflowRepository: Repository<Workflow>;
  let runRepository: Repository<Run>;
  let stepRepository: Repository<Step>;
  let eventRepository: Repository<Event>;

  const mockWorkflowRepository = {
    findOne: jest.fn(),
  };

  const mockRunRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockStepRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  const mockAgentRuntimeService = {
    runAgentStep: jest.fn().mockResolvedValue({
      text: 'Agent response',
      toolCalls: [],
      finishReason: 'stop',
    }),
    getAgent: jest.fn(),
  };

  const mockToolRuntimeService = {
    callTool: jest.fn().mockResolvedValue({ result: 'Tool executed' }),
    getTool: jest.fn(),
    getAllTools: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        {
          provide: getRepositoryToken(Workflow),
          useValue: mockWorkflowRepository,
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
          useValue: mockAgentRuntimeService,
        },
        {
          provide: ToolRuntimeService,
          useValue: mockToolRuntimeService,
        },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    workflowRepository = module.get<Repository<Workflow>>(
      getRepositoryToken(Workflow),
    );
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
    stepRepository = module.get<Repository<Step>>(getRepositoryToken(Step));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startRun', () => {
    it('should start a run for a valid workflow', async () => {
      const workflow = {
        id: 'workflow-123',
        name: 'Test Workflow',
        version: '1.0.0',
        definition: {
          nodes: [{ id: 'node1', type: 'static' }],
          edges: [],
          entryNode: 'node1',
        },
        type: 'linear',
      };

      const run = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        workflow_version: '1.0.0',
        status: 'pending',
        mode: 'draft',
        input: { test: 'data' },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockWorkflowRepository.findOne.mockResolvedValue(workflow);
      mockRunRepository.create.mockReturnValue(run);
      mockRunRepository.save.mockResolvedValue(run);
      mockEventRepository.save.mockResolvedValue({});

      const result = await service.startRun(
        'workflow-123',
        { test: 'data' },
        'draft',
        'tenant-1',
      );

      expect(result).toEqual(run);
      expect(mockWorkflowRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'workflow-123' },
      });
      expect(mockRunRepository.create).toHaveBeenCalled();
      expect(mockRunRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockWorkflowRepository.findOne.mockResolvedValue(null);

      await expect(
        service.startRun('invalid-id', {}, 'draft'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('executeNode - agent and tool nodes', () => {
    it('should execute agent node', async () => {
      const workflow = {
        id: 'workflow-123',
        name: 'Test Workflow',
        version: '1.0.0',
        definition: {
          nodes: [
            {
              id: 'agent1',
              type: 'agent',
              config: { agent_id: 'agent.test' },
            },
          ],
          edges: [],
          entryNode: 'agent1',
        },
        type: 'linear',
      };

      const run = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        status: 'running',
        mode: 'draft',
        input: {},
        tenant_id: 'tenant-1',
        app_id: null,
        user_id: null,
      };

      mockWorkflowRepository.findOne.mockResolvedValue(workflow);
      mockRunRepository.findOne.mockResolvedValue(run);
      mockRunRepository.save.mockResolvedValue(run);
      mockStepRepository.create.mockReturnValue({
        id: 'step-123',
        run_id: 'run-123',
        node_id: 'agent1',
        status: 'pending',
      });
      mockStepRepository.save.mockResolvedValue({
        id: 'step-123',
        status: 'completed',
      });
      mockEventRepository.save.mockResolvedValue({});

      await service.executeWorkflow('run-123', workflow);

      expect(mockAgentRuntimeService.runAgentStep).toHaveBeenCalledWith(
        'agent.test',
        expect.objectContaining({
          runId: 'run-123',
          stepId: expect.any(String),
          tenantId: 'tenant-1',
          workflowInput: {},
        }),
        expect.anything(),
      );
    });

    it('should execute tool node', async () => {
      const workflow = {
        id: 'workflow-123',
        name: 'Test Workflow',
        version: '1.0.0',
        definition: {
          nodes: [
            {
              id: 'tool1',
              type: 'tool',
              config: { tool_id: 'test-tool', input: { query: 'test' } },
            },
          ],
          edges: [],
          entryNode: 'tool1',
        },
        type: 'linear',
      };

      const run = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        status: 'running',
        mode: 'draft',
        input: {},
        tenant_id: 'tenant-1',
        app_id: null,
        user_id: null,
      };

      mockWorkflowRepository.findOne.mockResolvedValue(workflow);
      mockRunRepository.findOne.mockResolvedValue(run);
      mockRunRepository.save.mockResolvedValue(run);
      mockStepRepository.create.mockReturnValue({
        id: 'step-123',
        run_id: 'run-123',
        node_id: 'tool1',
        status: 'pending',
      });
      mockStepRepository.save.mockResolvedValue({
        id: 'step-123',
        status: 'completed',
      });
      mockEventRepository.save.mockResolvedValue({});

      await service.executeWorkflow('run-123', workflow);

      expect(mockToolRuntimeService.callTool).toHaveBeenCalledWith(
        'test-tool',
        { query: 'test' },
        expect.objectContaining({
          runId: 'run-123',
          tenantId: 'tenant-1',
        }),
      );
    });
  });
});

