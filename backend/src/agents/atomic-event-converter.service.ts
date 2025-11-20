import { Injectable, Optional } from '@nestjs/common';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Step, StepStatus, StepType } from '../runs/entities/step.entity';
import { Run, RunStatus, RunMode } from '../runs/entities/run.entity';
import { TdlnTService } from '../tdln-t/tdln-t.service';
import { AtomicValidatorService } from './validators/atomic-validator.service';
import * as crypto from 'crypto';

/**
 * JSON✯Atomic Format Interfaces
 * 
 * Based on JSON✯Atomic Core v1.0 specification
 * Focus: LLM understanding, reducing hallucinations, preventing forgetting
 */
export interface AtomicHeader {
  who: {
    id: string;
    role?: string;
    key_id?: string;
    [key: string]: any;
  };
  did: string;
  this: {
    id: string;
    [key: string]: any;
  };
  when: {
    ts: string; // ISO 8601
    recv_ts: string;
    commit_ts: string;
  };
  confirmed_by?: Array<{
    key_id: string;
    signature: string;
  }>;
  if_ok?: Record<string, any>;
  if_doubt?: Record<string, any>;
  if_not?: Record<string, any>;
  status: 'APPROVE' | 'REVIEW' | 'DENY';
}

export interface AtomicMeta {
  header: AtomicHeader;
  trace_id: string;
  context_id: string;
  owner_id: string;
  version: string;
  clock?: Record<string, any>;
  metrics?: Record<string, any>;
}

export interface AtomicEvent {
  type: string; // e.g., "event.tool_call@1.0.0"
  schema_id: string;
  body: Record<string, any>;
  meta: AtomicMeta;
  hash: string;
  prev_hash?: string;
  signature?: string;
  attachments?: Array<{
    name: string;
    mime: string;
    sha256: string;
    bytes: number;
  }>;
}

export interface AtomicStep {
  type: string; // e.g., "step.agent@1.0.0"
  schema_id: string;
  body: {
    node_id: string;
    input?: Record<string, any> | null;
    output?: Record<string, any> | null;
    status: string;
  };
  meta: AtomicMeta;
  hash: string;
  prev_hash?: string;
  signature?: string;
  attachments?: Array<{
    name: string;
    mime: string;
    sha256: string;
    bytes: number;
  }>;
}

export interface AtomicContext {
  run_id: string;
  steps: AtomicStep[];
  events: AtomicEvent[];
}

/**
 * Atomic Event Converter Service
 * 
 * Converts our internal events, steps, and runs to JSON✯Atomic format
 * for LLM consumption. This structured format helps LLMs:
 * - Understand context better (self-describing structure)
 * - Reduce hallucinations (clear actor identification)
 * - Prevent forgetting (traceability with prev_hash)
 */
@Injectable()
export class AtomicEventConverterService {
  constructor(
    @Optional() private tdlnTService?: TdlnTService,
    @Optional() private atomicValidator?: AtomicValidatorService,
  ) {}
  /**
   * Convert Event to JSON✯Atomic format
   */
  async convertEvent(
    event: Event,
    run: Run,
    step?: Step,
    previousHash?: string,
  ): Promise<AtomicEvent> {
    const type = `event.${event.kind}@1.0.0`;
    const actor = this.extractActor(event, run, step);

    // Refract text in payload to JSON✯Atomic format (if TDLN-T available)
    let body = event.payload || {};
    if (this.tdlnTService && event.payload) {
      body = await this.refractTextInPayload(event.payload);
    }

    const atomicEvent: AtomicEvent = {
      type,
      schema_id: type,
      body,
      meta: {
        header: {
          who: {
            id: actor.id,
            role: actor.role,
            key_id: run.user_id || run.tenant_id,
          },
          did: this.extractAction(event),
          this: {
            id: event.id,
            run_id: event.run_id,
            step_id: event.step_id || undefined,
          },
          when: {
            ts: event.ts.toISOString(),
            recv_ts: event.ts.toISOString(),
            commit_ts: event.ts.toISOString(),
          },
          status: this.extractStatus(event, run),
        },
        trace_id: run.id,
        context_id: step?.id || event.step_id || run.id,
        owner_id: run.tenant_id,
        version: '1.0.0',
      },
      hash: this.computeHash(event, previousHash),
    };

    if (previousHash) {
      atomicEvent.prev_hash = previousHash;
    }

    // Validate atomic event structure
    if (this.atomicValidator) {
      this.atomicValidator.validateAtomicEvent(atomicEvent);
    }

    return atomicEvent;
  }

  /**
   * Convert Step to JSON✯Atomic format
   */
  convertStep(
    step: Step,
    run: Run,
    previousHash?: string,
  ): AtomicStep {
    const type = `step.${step.type}@1.0.0`;
    const actor = this.extractStepActor(step);

    const atomicStep: AtomicStep = {
      type,
      schema_id: type,
      body: {
        node_id: step.node_id,
        input: step.input || undefined,
        output: step.output || undefined,
        status: step.status,
      },
      meta: {
        header: {
          who: {
            id: actor.id,
            role: actor.role,
            key_id: run.tenant_id,
          },
          did: `execute_${step.type}_node`,
          this: {
            id: step.id,
            node_id: step.node_id,
            run_id: step.run_id,
          },
          when: {
            ts: step.started_at.toISOString(),
            recv_ts: step.started_at.toISOString(),
            commit_ts: step.finished_at?.toISOString() || step.started_at.toISOString(),
          },
          status: this.mapStepStatusToAtomic(step.status),
        },
        trace_id: run.id,
        context_id: step.id,
        owner_id: run.tenant_id,
        version: '1.0.0',
      },
      hash: this.computeHash(step, previousHash),
    };

    if (previousHash) {
      atomicStep.prev_hash = previousHash;
    }

    // Validate atomic step structure
    if (this.atomicValidator) {
      this.atomicValidator.validateAtomicStep(atomicStep);
    }

    return atomicStep;
  }

  /**
   * Build atomic context chain (with prev_hash linking)
   * This creates a verifiable chain that LLMs can follow
   */
  async buildAtomicContextChain(
    steps: Step[],
    events: Event[],
    run: Run,
  ): Promise<AtomicContext> {
    // Convert steps with prev_hash linking
    const atomicSteps: AtomicStep[] = [];
    let prevStepHash: string | undefined;

    for (const step of steps) {
      const atomicStep = this.convertStep(step, run, prevStepHash);
      atomicSteps.push(atomicStep);
      prevStepHash = atomicStep.hash;
    }

    // Convert events with prev_hash linking
    const atomicEvents: AtomicEvent[] = [];
    let prevEventHash: string | undefined;

    for (const event of events) {
      const step = steps.find((s) => s.id === event.step_id);
      const atomicEvent = await this.convertEvent(event, run, step, prevEventHash);
      atomicEvents.push(atomicEvent);
      prevEventHash = atomicEvent.hash;
    }

    return {
      run_id: run.id,
      steps: atomicSteps,
      events: atomicEvents,
    };
  }

  /**
   * Compute SHA-256 hash for atomic format
   */
  private computeHash(item: any, prevHash?: string): string {
    // Create hashable content: item data + previous hash
    const content = JSON.stringify({
      type: item.type || item.kind || 'unknown',
      id: item.id,
      data: item.payload || item.input || item.output || item,
      prev_hash: prevHash,
    });

    // Compute SHA-256 hash
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extract actor information from event
   */
  private extractActor(event: Event, run: Run, step?: Step): { id: string; role: string } {
    // Try to extract from payload
    if (event.payload?.agent_id) {
      return { id: event.payload.agent_id, role: 'agent' };
    }

    if (event.payload?.tool_id) {
      return { id: event.payload.tool_id, role: 'tool' };
    }

    // Infer from event kind
    if (event.kind === EventKind.LLM_CALL) {
      return { id: event.payload?.agent_id || 'unknown_agent', role: 'agent' };
    }

    if (event.kind === EventKind.TOOL_CALL) {
      return { id: event.payload?.tool_id || 'unknown_tool', role: 'tool' };
    }

    // Infer from step
    if (step) {
      if (step.type === StepType.AGENT) {
        return { id: step.node_id, role: 'agent' };
      }
      if (step.type === StepType.TOOL) {
        return { id: step.node_id, role: 'tool' };
      }
    }

    // Default to system
    return { id: 'system', role: 'system' };
  }

  /**
   * Extract action description from event
   */
  private extractAction(event: Event): string {
    // Convert event kind to human-readable action
    const actionMap: Record<EventKind, string> = {
      [EventKind.RUN_STARTED]: 'started workflow run',
      [EventKind.RUN_COMPLETED]: 'completed workflow run',
      [EventKind.RUN_FAILED]: 'failed workflow run',
      [EventKind.STEP_STARTED]: 'started step execution',
      [EventKind.STEP_COMPLETED]: 'completed step execution',
      [EventKind.STEP_FAILED]: 'failed step execution',
      [EventKind.TOOL_CALL]: 'called tool',
      [EventKind.LLM_CALL]: 'called LLM',
      [EventKind.POLICY_EVAL]: 'evaluated policy',
      [EventKind.ERROR]: 'encountered error',
    };

    return actionMap[event.kind] || event.kind.replace(/_/g, ' ');
  }

  /**
   * Extract status from event/run
   */
  private extractStatus(event: Event, run: Run): 'APPROVE' | 'REVIEW' | 'DENY' {
    // If run is in auto mode, approve automatically
    if (run.mode === RunMode.AUTO) {
      return 'APPROVE';
    }

    // If run is in draft mode, require review
    if (run.mode === RunMode.DRAFT) {
      return 'REVIEW';
    }

    // If event is an error, deny
    if (event.kind === EventKind.ERROR || event.kind === EventKind.RUN_FAILED) {
      return 'DENY';
    }

    // Default to approve
    return 'APPROVE';
  }

  /**
   * Extract step actor
   */
  private extractStepActor(step: Step): { id: string; role: string } {
    if (step.type === StepType.AGENT) {
      return { id: step.node_id, role: 'agent' };
    }
    if (step.type === StepType.TOOL) {
      return { id: step.node_id, role: 'tool' };
    }
    if (step.type === StepType.ROUTER) {
      return { id: step.node_id, role: 'router' };
    }
    return { id: step.node_id, role: 'system' };
  }

  /**
   * Map step status to atomic status
   */
  private mapStepStatusToAtomic(status: StepStatus): 'APPROVE' | 'REVIEW' | 'DENY' {
    if (status === StepStatus.COMPLETED) {
      return 'APPROVE';
    }
    if (status === StepStatus.FAILED) {
      return 'DENY';
    }
    if (status === StepStatus.SKIPPED) {
      return 'DENY';
    }
    // PENDING, RUNNING -> REVIEW
    return 'REVIEW';
  }

  /**
   * Convert atomic context to natural language summary for LLMs
   * This combines atomic structure with natural language for best understanding
   */
  formatAtomicContextForLLM(atomicContext: AtomicContext): string {
    const parts: string[] = [];

    parts.push(`Execution Context (Structured Format):`);
    parts.push(`Run ID: ${atomicContext.run_id}`);
    parts.push('');

    if (atomicContext.steps.length > 0) {
      parts.push(`Steps (${atomicContext.steps.length} total):`);
      atomicContext.steps.forEach((step, index) => {
        const stepNum = index + 1;
        parts.push(`\n${stepNum}. ${step.meta.header.who.id} ${step.meta.header.did}`);
        parts.push(`   Type: ${step.type}`);
        parts.push(`   Node: ${step.body.node_id}`);
        parts.push(`   Status: ${step.body.status} (${step.meta.header.status})`);
        parts.push(`   When: ${step.meta.header.when.ts}`);
        if (step.body.output) {
          parts.push(`   Output: ${JSON.stringify(step.body.output, null, 2).substring(0, 200)}...`);
        }
        if (step.prev_hash) {
          parts.push(`   Links to previous step (hash: ${step.prev_hash.substring(0, 16)}...)`);
        }
      });
      parts.push('');
    }

    if (atomicContext.events.length > 0) {
      parts.push(`Events (${atomicContext.events.length} total):`);
      atomicContext.events.forEach((event, index) => {
        const eventNum = index + 1;
        parts.push(`\n${eventNum}. ${event.meta.header.who.id} ${event.meta.header.did}`);
        parts.push(`   Type: ${event.type}`);
        parts.push(`   When: ${event.meta.header.when.ts}`);
        if (event.prev_hash) {
          parts.push(`   Links to previous event (hash: ${event.prev_hash.substring(0, 16)}...)`);
        }
      });
    }

    parts.push('');
    parts.push('This structured format helps you understand:');
    parts.push('- Who did what (meta.header.who, meta.header.did)');
    parts.push('- When it happened (meta.header.when)');
    parts.push('- What the result was (body)');
    parts.push('- How it connects (trace_id, context_id, prev_hash)');
    parts.push('');
    parts.push('Use this structured information to make informed decisions.');

    return parts.join('\n');
  }

  /**
   * Refract text fields in payload to JSON✯Atomic format
   * This structures natural language for better LLM understanding
   */
  private async refractTextInPayload(payload: Record<string, any>): Promise<Record<string, any>> {
    if (!this.tdlnTService) {
      return payload; // No TDLN-T service, return as-is
    }

    const refracted: Record<string, any> = { ...payload };

    // Recursively find and refract string values
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        // Check if it looks like natural language (not JSON, not code)
        if (this.isNaturalLanguage(value)) {
          try {
            const atomic = await this.tdlnTService.refractToAtomic(value);
            refracted[`${key}_refracted`] = atomic;
            // Keep original for reference
            refracted[`${key}_original`] = value;
          } catch (error) {
            // If refraction fails, keep original
            // Note: Logger not available in this service, but error is caught and handled gracefully
            // Refraction is optional enhancement, so failure is acceptable
          }
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively process nested objects
        refracted[key] = await this.refractTextInPayload(value);
      }
    }

    return refracted;
  }

  /**
   * Check if a string is natural language (should be refracted)
   */
  private isNaturalLanguage(text: string): boolean {
    // Don't refract if it's:
    // - JSON (starts with { or [)
    // - Code (contains common code patterns)
    // - Too short (less than 3 words)
    // - Already structured (contains structured patterns)

    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return false; // JSON
    }

    if (text.includes('function') || text.includes('const ') || text.includes('import ')) {
      return false; // Code
    }

    const words = text.trim().split(/\s+/);
    if (words.length < 3) {
      return false; // Too short
    }

    return true; // Looks like natural language
  }
}

