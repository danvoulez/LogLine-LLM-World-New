import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrchestratorService } from './orchestrator.service';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Run } from '../runs/entities/run.entity';
import { Step } from '../runs/entities/step.entity';
import { Event } from '../runs/entities/event.entity';
import { AgentRuntimeService } from '../agents/agent-runtime.service';
import { ToolRuntimeService } from '../tools/tool-runtime.service';

describe('OrchestratorService - Router Nodes', () => {
  let service: OrchestratorService;
  let mockAgentRuntimeService: any;
  let mockStepRepository: any;

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
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEventRepository = {
    save: jest.fn(),
  };

  beforeEach(async () => {
    mockAgentRuntimeService = {
      runAgentStep: jest.fn().mockResolvedValue({
        text: 'high_priority',
        toolCalls: [],
        finishReason: 'stop',
      }),
      getAgent: jest.fn(),
    };

    const mockToolRuntimeService = {
      callTool: jest.fn(),
      getTool: jest.fn(),
      getAllTools: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: getRepositoryToken(Workflow), useValue: mockWorkflowRepository },
        { provide: getRepositoryToken(Run), useValue: mockRunRepository },
        { provide: getRepositoryToken(Step), useValue: mockStepRepository },
        { provide: getRepositoryToken(Event), useValue: mockEventRepository },
        { provide: AgentRuntimeService, useValue: mockAgentRuntimeService },
        { provide: ToolRuntimeService, useValue: mockToolRuntimeService },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
  });

  describe('Router Node Execution', () => {
    it('should use agent to determine routing', async () => {
      const workflow = {
        id: 'workflow-123',
        name: 'Router Test Workflow',
        version: '1.0.0',
        definition: {
          entryNode: 'start',
          nodes: [
            { id: 'start', type: 'static' },
            {
              id: 'router',
              type: 'router',
              config: {
                router_agent_id: 'agent.router',
                routes: [
                  { id: 'high_priority', condition: 'if priority is high', target_node: 'escalate' },
                  { id: 'normal', condition: 'if priority is normal', target_node: 'process' },
                ],
              },
            },
            { id: 'escalate', type: 'static' },
            { id: 'process', type: 'static' },
          ],
          edges: [
            { from: 'start', to: 'router' },
            { from: 'router', to: 'escalate' },
            { from: 'router', to: 'process' },
          ],
        },
        type: 'linear',
      };

      const run = {
        id: 'run-123',
        workflow_id: 'workflow-123',
        status: 'running',
        mode: 'draft',
        input: { priority: 'high' },
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
        node_id: 'start',
        status: 'pending',
      });
      mockStepRepository.save.mockResolvedValue({
        id: 'step-123',
        status: 'completed',
        output: { message: 'Started' },
      });
      mockStepRepository.find.mockResolvedValue([]);
      mockStepRepository.findOne.mockResolvedValue({
        id: 'step-123',
        node_id: 'start',
        output: { message: 'Started' },
      });
      mockEventRepository.save.mockResolvedValue({});

      await service.executeWorkflow('run-123', workflow);

      // Verify router agent was called
      expect(mockAgentRuntimeService.runAgentStep).toHaveBeenCalledWith(
        'agent.router',
        expect.objectContaining({
          runId: 'run-123',
          tenantId: 'tenant-1',
        }),
        expect.stringContaining('routing agent'),
      );
    });
  });

  describe('Conditional Edge Evaluation', () => {
    it('should use agent to evaluate conditional edges', async () => {
      mockAgentRuntimeService.runAgentStep.mockResolvedValue({
        text: '1',
        toolCalls: [],
        finishReason: 'stop',
      });

      const workflow = {
        id: 'workflow-123',
        name: 'Conditional Test Workflow',
        version: '1.0.0',
        definition: {
          entryNode: 'check',
          nodes: [
            { id: 'check', type: 'agent', config: { agent_id: 'agent.test' } },
            { id: 'approve', type: 'static' },
            { id: 'reject', type: 'static' },
          ],
          edges: [
            {
              from: 'check',
              to: 'approve',
              condition: 'if status is approved',
            },
            {
              from: 'check',
              to: 'reject',
              condition: 'if status is rejected',
            },
          ],
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
        node_id: 'check',
        status: 'pending',
      });
      mockStepRepository.save.mockResolvedValue({
        id: 'step-123',
        status: 'completed',
        output: { status: 'approved' },
      });
      mockStepRepository.find.mockResolvedValue([]);
      mockStepRepository.findOne.mockResolvedValue({
        id: 'step-123',
        node_id: 'check',
        output: { status: 'approved' },
      });
      mockEventRepository.save.mockResolvedValue({});

      await service.executeWorkflow('run-123', workflow);

      // Verify condition evaluator agent was called
      expect(mockAgentRuntimeService.runAgentStep).toHaveBeenCalledWith(
        'agent.condition_evaluator',
        expect.any(Object),
        expect.stringContaining('condition evaluator'),
      );
    });
  });
});

