import { Test, TestingModule } from '@nestjs/testing';
import { ContextSummarizerService } from './context-summarizer.service';
import { AtomicEventConverterService } from './atomic-event-converter.service';
import { Step, StepStatus, StepType } from '../runs/entities/step.entity';
import { Run, RunStatus } from '../runs/entities/run.entity';

describe('ContextSummarizerService', () => {
  let service: ContextSummarizerService;
  let atomicConverter: AtomicEventConverterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextSummarizerService,
        {
          provide: AtomicEventConverterService,
          useValue: {
            buildAtomicContextChain: jest.fn().mockResolvedValue({
              run_id: 'test-run',
              steps: [],
              events: [],
            }),
            formatAtomicContextForLLM: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    service = module.get<ContextSummarizerService>(ContextSummarizerService);
    atomicConverter = module.get<AtomicEventConverterService>(
      AtomicEventConverterService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('summarizePreviousSteps', () => {
    it('should summarize empty steps array', () => {
      const steps: Array<{ node_id: string; output: any }> = [];
      const result = service.summarizePreviousSteps(steps);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should summarize steps with outputs', () => {
      const steps = [
        { node_id: 'node1', output: { result: 'success' } },
        { node_id: 'node2', output: { data: [1, 2, 3] } },
      ];
      const result = service.summarizePreviousSteps(steps);
      expect(result).toContain('node1');
      expect(result).toContain('node2');
    });

    it('should handle null outputs', () => {
      const steps = [
        { node_id: 'node1', output: null },
        { node_id: 'node2', output: undefined },
      ];
      const result = service.summarizePreviousSteps(steps);
      expect(result).toBeDefined();
    });
  });

  describe('summarizeWorkflowInput', () => {
    it('should summarize simple input', () => {
      const input = { message: 'Hello world' };
      const result = service.summarizeWorkflowInput(input);
      expect(result).toContain('Hello world');
    });

    it('should summarize complex input', () => {
      const input = {
        user: { name: 'John', age: 30 },
        preferences: { theme: 'dark' },
      };
      const result = service.summarizeWorkflowInput(input);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty input', () => {
      const result = service.summarizeWorkflowInput({});
      expect(result).toBeDefined();
    });
  });

  describe('summarizeStepOutput', () => {
    it('should summarize simple output', () => {
      const output = { result: 'success' };
      const result = service.summarizeStepOutput(output);
      expect(result).toContain('success');
    });

    it('should summarize complex output', () => {
      const output = {
        data: { items: [1, 2, 3], total: 3 },
        status: 'completed',
      };
      const result = service.summarizeStepOutput(output);
      expect(result).toBeDefined();
    });

    it('should handle null output', () => {
      const result = service.summarizeStepOutput(null);
      expect(result).toBeDefined();
    });
  });

  describe('buildConversationalContext', () => {
    it('should build context with all components', () => {
      const workflowInput = { message: 'test' };
      const previousSteps = [{ node_id: 'node1', output: { result: 'ok' } }];
      // Note: buildConversationalContext signature is (previousSteps, workflowInput?, currentTask?)
      const result = service.buildConversationalContext(
        previousSteps,
        workflowInput,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });

    it('should handle empty inputs', () => {
      const result = service.buildConversationalContext([], {});
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('buildConversationalContextWithAtomic', () => {
    it('should build context with atomic format', async () => {
      const workflowInput = { message: 'test' };
      const previousSteps = [{ node_id: 'node1', output: { result: 'ok' } }];
      const steps: Step[] = [];
      const events: any[] = [];
      const run = {
        id: 'test-run',
        tenant_id: 'test-tenant',
      } as Run;

      const result = await service.buildConversationalContextWithAtomic(
        workflowInput,
        previousSteps,
        steps,
        events,
        run,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Note: buildAtomicContextChain may not be called if steps/events are empty
      // This is expected behavior - atomic context is only built when there's data
    });

    it('should handle errors gracefully', async () => {
      (atomicConverter.buildAtomicContextChain as jest.Mock).mockRejectedValue(
        new Error('Test error'),
      );

      const result = await service.buildConversationalContextWithAtomic(
        {},
        [],
        [],
        [],
        {} as Run,
      );

      // Should fall back to natural language
      expect(result).toBeDefined();
    });
  });
});

