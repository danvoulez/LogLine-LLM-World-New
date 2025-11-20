import { Test, TestingModule } from '@nestjs/testing';
import { AtomicEventConverterService } from './atomic-event-converter.service';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Step, StepType, StepStatus } from '../runs/entities/step.entity';
import { Run, RunStatus, RunMode } from '../runs/entities/run.entity';

describe('AtomicEventConverterService', () => {
  let service: AtomicEventConverterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtomicEventConverterService],
    }).compile();

    service = module.get<AtomicEventConverterService>(AtomicEventConverterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convertEvent', () => {
    it('should convert event to atomic format', async () => {
      const event: Partial<Event> = {
        id: 'event-123',
        kind: EventKind.TOOL_CALL,
        payload: { tool_id: 'test_tool', result: 'success' },
        run_id: 'run-456',
        step_id: 'step-789',
        ts: new Date('2024-01-01T00:00:00Z'),
      };

      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        user_id: 'user-456',
        mode: RunMode.AUTO,
      };

      const atomicEvent = service.convertEvent(
        event as Event,
        run as Run,
        undefined,
        undefined,
      );

      expect(atomicEvent).toBeDefined();
      expect(atomicEvent.type).toBe('event.tool_call@1.0.0');
      expect(atomicEvent.schema_id).toBe('event.tool_call@1.0.0');
      expect(atomicEvent.body).toEqual({ tool_id: 'test_tool', result: 'success' });
      expect(atomicEvent.meta.header.who.id).toBeDefined();
      expect(atomicEvent.meta.header.did).toBe('called tool');
      expect(atomicEvent.meta.header.this.id).toBe('event-123');
      expect(atomicEvent.meta.trace_id).toBe('run-456');
      expect(atomicEvent.meta.owner_id).toBe('tenant-123');
      expect(atomicEvent.hash).toBeDefined();
      expect(atomicEvent.hash.length).toBe(64); // SHA-256 hex string
    });

    it('should include prev_hash when provided', async () => {
      const event: Partial<Event> = {
        id: 'event-123',
        kind: EventKind.LLM_CALL,
        payload: { agent_id: 'agent.test', response: 'test' },
        run_id: 'run-456',
        ts: new Date('2024-01-01T00:00:00Z'),
      };

      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const prevHash = 'abc123def456';
      const atomicEvent = await service.convertEvent(
        event as Event,
        run as Run,
        undefined,
        prevHash,
      );

      expect(atomicEvent.prev_hash).toBe(prevHash);
    });

    it('should extract actor from event payload', async () => {
      const event: Partial<Event> = {
        id: 'event-123',
        kind: EventKind.LLM_CALL,
        payload: { agent_id: 'agent.router', response: 'test' },
        run_id: 'run-456',
        ts: new Date('2024-01-01T00:00:00Z'),
      };

      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const atomicEvent = service.convertEvent(
        event as Event,
        run as Run,
        undefined,
        undefined,
      );

      expect(atomicEvent.meta.header.who.id).toBe('agent.router');
      expect(atomicEvent.meta.header.who.role).toBe('agent');
    });
  });

  describe('convertStep', () => {
    it('should convert step to atomic format', () => {
      const step: Partial<Step> = {
        id: 'step-123',
        run_id: 'run-456',
        node_id: 'agent_node',
        type: StepType.AGENT,
        status: StepStatus.COMPLETED,
        input: { message: 'test input' },
        output: { text: 'test output' },
        started_at: new Date('2024-01-01T00:00:00Z'),
        finished_at: new Date('2024-01-01T00:01:00Z'),
      };

      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const atomicStep = service.convertStep(step as Step, run as Run, undefined);

      expect(atomicStep).toBeDefined();
      expect(atomicStep.type).toBe('step.agent@1.0.0');
      expect(atomicStep.schema_id).toBe('step.agent@1.0.0');
      expect(atomicStep.body.node_id).toBe('agent_node');
      expect(atomicStep.body.status).toBe('completed');
      expect(atomicStep.body.input).toEqual({ message: 'test input' });
      expect(atomicStep.body.output).toEqual({ text: 'test output' });
      expect(atomicStep.meta.header.who.id).toBe('agent_node');
      expect(atomicStep.meta.header.who.role).toBe('agent');
      expect(atomicStep.meta.header.did).toBe('execute_agent_node');
      expect(atomicStep.meta.header.status).toBe('APPROVE');
      expect(atomicStep.hash).toBeDefined();
    });

    it('should map step status to atomic status correctly', () => {
      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const statusMap = [
        { status: StepStatus.COMPLETED, expected: 'APPROVE' },
        { status: StepStatus.FAILED, expected: 'DENY' },
        { status: StepStatus.SKIPPED, expected: 'DENY' },
        { status: StepStatus.PENDING, expected: 'REVIEW' },
        { status: StepStatus.RUNNING, expected: 'REVIEW' },
      ];

      for (const { status, expected } of statusMap) {
        const step: Partial<Step> = {
          id: 'step-123',
          run_id: 'run-456',
          node_id: 'test_node',
          type: StepType.STATIC,
          status,
          started_at: new Date('2024-01-01T00:00:00Z'),
        };

        const atomicStep = service.convertStep(step as Step, run as Run, undefined);
        expect(atomicStep.meta.header.status).toBe(expected);
      }
    });
  });

  describe('buildAtomicContextChain', () => {
    it('should build atomic context chain with prev_hash linking', async () => {
      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const steps: Partial<Step>[] = [
        {
          id: 'step-1',
          run_id: 'run-456',
          node_id: 'start',
          type: StepType.STATIC,
          status: StepStatus.COMPLETED,
          started_at: new Date('2024-01-01T00:00:00Z'),
          finished_at: new Date('2024-01-01T00:01:00Z'),
        },
        {
          id: 'step-2',
          run_id: 'run-456',
          node_id: 'process',
          type: StepType.AGENT,
          status: StepStatus.COMPLETED,
          started_at: new Date('2024-01-01T00:01:00Z'),
          finished_at: new Date('2024-01-01T00:02:00Z'),
        },
      ];

      const events: Partial<Event>[] = [
        {
          id: 'event-1',
          run_id: 'run-456',
          step_id: 'step-1',
          kind: EventKind.STEP_STARTED,
          payload: { node_id: 'start' },
          ts: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'event-2',
          run_id: 'run-456',
          step_id: 'step-2',
          kind: EventKind.STEP_COMPLETED,
          payload: { node_id: 'process' },
          ts: new Date('2024-01-01T00:02:00Z'),
        },
      ];

      const atomicContext = await service.buildAtomicContextChain(
        steps as Step[],
        events as Event[],
        run as Run,
      );

      expect(atomicContext).toBeDefined();
      expect(atomicContext.run_id).toBe('run-456');
      expect(atomicContext.steps.length).toBe(2);
      expect(atomicContext.events.length).toBe(2);

      // Check prev_hash linking for steps
      expect(atomicContext.steps[0].prev_hash).toBeUndefined(); // First step has no prev
      expect(atomicContext.steps[1].prev_hash).toBe(atomicContext.steps[0].hash); // Second links to first

      // Check prev_hash linking for events
      expect(atomicContext.events[0].prev_hash).toBeUndefined(); // First event has no prev
      expect(atomicContext.events[1].prev_hash).toBe(atomicContext.events[0].hash); // Second links to first
    });
  });

  describe('formatAtomicContextForLLM', () => {
    it('should format atomic context for LLM consumption', async () => {
      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const steps: Partial<Step>[] = [
        {
          id: 'step-1',
          run_id: 'run-456',
          node_id: 'test_node',
          type: StepType.AGENT,
          status: StepStatus.COMPLETED,
          output: { result: 'success' },
          started_at: new Date('2024-01-01T00:00:00Z'),
          finished_at: new Date('2024-01-01T00:01:00Z'),
        },
      ];

      const events: Partial<Event>[] = [];

      const atomicContext = await service.buildAtomicContextChain(
        steps as Step[],
        events as Event[],
        run as Run,
      );

      const formatted = service.formatAtomicContextForLLM(atomicContext);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('Execution Context (Structured Format)');
      expect(formatted).toContain('Run ID: run-456');
      expect(formatted).toContain('Steps (1 total)');
      expect(formatted).toContain('test_node');
      expect(formatted).toContain('execute_agent_node');
      expect(formatted).toContain('Who did what');
      expect(formatted).toContain('When it happened');
      expect(formatted).toContain('What the result was');
      expect(formatted).toContain('How it connects');
    });
  });

  describe('hash computation', () => {
    it('should generate consistent hashes', async () => {
      const event: Partial<Event> = {
        id: 'event-123',
        kind: EventKind.TOOL_CALL,
        payload: { tool_id: 'test' },
        run_id: 'run-456',
        ts: new Date('2024-01-01T00:00:00Z'),
      };

      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const atomicEvent1 = await service.convertEvent(
        event as Event,
        run as Run,
        undefined,
        undefined,
      );
      const atomicEvent2 = await service.convertEvent(
        event as Event,
        run as Run,
        undefined,
        undefined,
      );

      // Same input should produce same hash
      expect(atomicEvent1.hash).toBe(atomicEvent2.hash);
    });

    it('should generate different hashes for different inputs', async () => {
      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const event1: Partial<Event> = {
        id: 'event-1',
        kind: EventKind.TOOL_CALL,
        payload: { tool_id: 'tool1' },
        run_id: 'run-456',
        ts: new Date('2024-01-01T00:00:00Z'),
      };

      const event2: Partial<Event> = {
        id: 'event-2',
        kind: EventKind.TOOL_CALL,
        payload: { tool_id: 'tool2' },
        run_id: 'run-456',
        ts: new Date('2024-01-01T00:00:00Z'),
      };

      const atomicEvent1 = await service.convertEvent(
        event1 as Event,
        run as Run,
        undefined,
        undefined,
      );
      const atomicEvent2 = await service.convertEvent(
        event2 as Event,
        run as Run,
        undefined,
        undefined,
      );

      // Different inputs should produce different hashes
      expect(atomicEvent1.hash).not.toBe(atomicEvent2.hash);
    });

    it('should handle all event kinds', async () => {
      const run: Partial<Run> = {
        id: 'run-456',
        tenant_id: 'tenant-123',
        mode: RunMode.AUTO,
      };

      const eventKinds = Object.values(EventKind);
      for (const kind of eventKinds) {
        const event: Partial<Event> = {
          id: `event-${kind}`,
          kind,
          payload: { test: 'data' },
          run_id: 'run-456',
          ts: new Date('2024-01-01T00:00:00Z'),
        };

        const atomicEvent = await service.convertEvent(
          event as Event,
          run as Run,
        );

        expect(atomicEvent).toBeDefined();
        expect(atomicEvent.type).toContain(kind);
      }
    });
  });
});

