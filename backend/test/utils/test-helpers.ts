import { Repository } from 'typeorm';
import { Workflow, WorkflowType } from '../../src/workflows/entities/workflow.entity';
import { Run, RunStatus, RunMode } from '../../src/runs/entities/run.entity';
import { Step, StepStatus, StepType } from '../../src/runs/entities/step.entity';
import { Event, EventKind } from '../../src/runs/entities/event.entity';
import { Agent } from '../../src/agents/entities/agent.entity';
import { Tool } from '../../src/tools/entities/tool.entity';

/**
 * Test data factories for creating test entities
 */
export class TestHelpers {
  /**
   * Create a test workflow
   */
  static createTestWorkflow(overrides?: Partial<Workflow>): Workflow {
    return {
      id: overrides?.id || 'test-workflow-id',
      name: overrides?.name || 'Test Workflow',
      version: overrides?.version || '1.0.0',
      type: overrides?.type || WorkflowType.LINEAR,
      definition: overrides?.definition || {
        nodes: [
          { id: 'start', type: 'static', config: { value: 'start' } },
          { id: 'agent1', type: 'agent', config: { agent_id: 'agent.test' } },
        ],
        edges: [
          { from: 'start', to: 'agent1' },
        ],
        entryNode: 'start',
      },
      created_at: overrides?.created_at || new Date(),
      updated_at: overrides?.updated_at || new Date(),
      runs: overrides?.runs || [],
    } as Workflow;
  }

  /**
   * Create a test run
   */
  static createTestRun(overrides?: Partial<Run>): Run {
    return {
      id: overrides?.id || 'test-run-id',
      workflow_id: overrides?.workflow_id || 'test-workflow-id',
      status: overrides?.status || RunStatus.RUNNING,
      mode: overrides?.mode || RunMode.DRAFT,
      input: overrides?.input || {},
      result: overrides?.result || null,
      tenant_id: overrides?.tenant_id || 'test-tenant',
      user_id: overrides?.user_id || 'test-user',
      app_id: overrides?.app_id || undefined,
      app_action_id: overrides?.app_action_id || undefined,
      started_at: overrides?.started_at || new Date(),
      finished_at: overrides?.finished_at || undefined,
      workflow: overrides?.workflow || undefined,
      steps: overrides?.steps || [],
    } as Run;
  }

  /**
   * Create a test step
   */
  static createTestStep(overrides?: Partial<Step>): Step {
    return {
      id: overrides?.id || 'test-step-id',
      run_id: overrides?.run_id || 'test-run-id',
      node_id: overrides?.node_id || 'test-node',
      type: overrides?.type || StepType.AGENT,
      status: overrides?.status || StepStatus.RUNNING,
      input: overrides?.input || {},
      output: overrides?.output || null,
      started_at: overrides?.started_at || new Date(),
      finished_at: overrides?.finished_at || undefined,
      run: overrides?.run || undefined,
    } as Step;
  }

  /**
   * Create a test event
   */
  static createTestEvent(overrides?: Partial<Event>): Event {
    return {
      id: overrides?.id || 'test-event-id',
      run_id: overrides?.run_id || 'test-run-id',
      step_id: overrides?.step_id || 'test-step-id',
      kind: overrides?.kind || EventKind.STEP_STARTED,
      payload: overrides?.payload || {},
      ts: overrides?.ts || new Date(),
      run: overrides?.run || undefined,
      step: overrides?.step || undefined,
    } as Event;
  }

  /**
   * Create a test agent
   */
  static createTestAgent(overrides?: Partial<Agent>): Agent {
    return {
      id: overrides?.id || 'agent.test',
      name: overrides?.name || 'Test Agent',
      description: overrides?.description || 'Test agent description',
      instructions: overrides?.instructions || 'You are a test agent.',
      model_profile: overrides?.model_profile || {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 2000,
      },
      allowed_tools: overrides?.allowed_tools || [],
      created_at: overrides?.created_at || new Date(),
      updated_at: overrides?.updated_at || new Date(),
    } as Agent;
  }

  /**
   * Create a test tool
   */
  static createTestTool(overrides?: Partial<Tool>): Tool {
    return {
      id: overrides?.id || 'tool.test',
      name: overrides?.name || 'Test Tool',
      description: overrides?.description || 'Test tool description',
      input_schema: overrides?.input_schema || {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
      created_at: overrides?.created_at || new Date(),
      updated_at: overrides?.updated_at || new Date(),
    } as Tool;
  }

  /**
   * Mock repository with basic CRUD operations
   */
  static createMockRepository<T>(): Partial<Repository<T>> {
    const data: T[] = [];
    return {
      find: jest.fn().mockResolvedValue(data),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity: T) => {
        data.push(entity);
        return Promise.resolve(entity);
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      findAndCount: jest.fn().mockResolvedValue([data, data.length]),
    };
  }
}

