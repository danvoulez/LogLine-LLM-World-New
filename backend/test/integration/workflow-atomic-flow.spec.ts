import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrchestratorService } from '../../src/execution/orchestrator.service';
import { AgentRuntimeService } from '../../src/agents/agent-runtime.service';
import { ToolRuntimeService } from '../../src/tools/tool-runtime.service';
import { AtomicEventConverterService } from '../../src/agents/atomic-event-converter.service';
import { ContextSummarizerService } from '../../src/agents/context-summarizer.service';
import { Workflow } from '../../src/workflows/entities/workflow.entity';
import { Run, RunStatus } from '../../src/runs/entities/run.entity';
import { Step, StepStatus } from '../../src/runs/entities/step.entity';
import { Event, EventKind } from '../../src/runs/entities/event.entity';
import { TestHelpers } from '../utils/test-helpers';
import { AtomicValidators } from '../utils/atomic-validators';

/**
 * Integration test for workflow execution with JSON✯Atomic flow
 */
describe('Workflow Atomic Flow Integration', () => {
  let orchestrator: OrchestratorService;
  let atomicConverter: AtomicEventConverterService;
  let workflowRepository: Repository<Workflow>;
  let runRepository: Repository<Run>;
  let stepRepository: Repository<Step>;
  let eventRepository: Repository<Event>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        {
          provide: getRepositoryToken(Workflow),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Run),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Step),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Event),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AgentRuntimeService,
          useValue: {
            runAgentStep: jest.fn().mockResolvedValue({
              text: 'Agent response',
              toolCalls: [],
              finishReason: 'stop',
            }),
          },
        },
        {
          provide: ToolRuntimeService,
          useValue: {
            callTool: jest.fn().mockResolvedValue({ result: 'success' }),
          },
        },
        {
          provide: ContextSummarizerService,
          useValue: {
            summarizePreviousSteps: jest.fn().mockReturnValue('Previous steps summary'),
            summarizeWorkflowInput: jest.fn().mockReturnValue('Input summary'),
            summarizeStepOutput: jest.fn().mockReturnValue('Output summary'),
            buildConversationalContext: jest.fn().mockReturnValue('Full context'),
            buildConversationalContextWithAtomic: jest.fn().mockResolvedValue('Full context with atomic'),
          },
        },
        AtomicEventConverterService,
      ],
    }).compile();

    orchestrator = module.get<OrchestratorService>(OrchestratorService);
    atomicConverter = module.get<AtomicEventConverterService>(AtomicEventConverterService);
    workflowRepository = module.get<Repository<Workflow>>(getRepositoryToken(Workflow));
    runRepository = module.get<Repository<Run>>(getRepositoryToken(Run));
    stepRepository = module.get<Repository<Step>>(getRepositoryToken(Step));
    eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  it('should convert events to atomic format', async () => {
    const event = TestHelpers.createTestEvent({
      kind: EventKind.TOOL_CALL,
      payload: { tool_id: 'test_tool', input: { test: 'data' } },
    });

    const run = TestHelpers.createTestRun();

    const atomicEvent = await atomicConverter.convertEvent(event, run);

    expect(AtomicValidators.isValidAtomicEvent(atomicEvent)).toBe(true);
    expect(atomicEvent.type).toContain('tool_call');
    expect(atomicEvent.body).toHaveProperty('tool_id');
  });

  it('should build atomic context chain with prev_hash linking', async () => {
    const run = TestHelpers.createTestRun();
    const steps = [
      TestHelpers.createTestStep({ node_id: 'step1', status: StepStatus.COMPLETED }),
      TestHelpers.createTestStep({ node_id: 'step2', status: StepStatus.COMPLETED }),
    ];
    const events = [
      TestHelpers.createTestEvent({ kind: EventKind.STEP_STARTED }),
      TestHelpers.createTestEvent({ kind: EventKind.STEP_COMPLETED }),
    ];

    const atomicContext = await atomicConverter.buildAtomicContextChain(steps, events, run);

    expect(atomicContext.steps.length).toBe(2);
    expect(atomicContext.events.length).toBe(2);

    // Verify prev_hash linking
    expect(atomicContext.steps[0].prev_hash).toBeUndefined();
    expect(atomicContext.steps[1].prev_hash).toBe(atomicContext.steps[0].hash);

    expect(AtomicValidators.validateHashChain(atomicContext.steps)).toBe(true);
    expect(AtomicValidators.validateHashChain(atomicContext.events)).toBe(true);
  });

  it('should format atomic context for LLM', async () => {
    const run = TestHelpers.createTestRun();
    const steps = [
      TestHelpers.createTestStep({
        node_id: 'agent_node',
        status: StepStatus.COMPLETED,
        output: { result: 'success' },
      }),
    ];
    const events: Event[] = [];

    const atomicContext = await atomicConverter.buildAtomicContextChain(steps, events, run);
    const formatted = atomicConverter.formatAtomicContextForLLM(atomicContext);

    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('Execution Context');
    expect(formatted).toContain('agent_node');
  });
});

