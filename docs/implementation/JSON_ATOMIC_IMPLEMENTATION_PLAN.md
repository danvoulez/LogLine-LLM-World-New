# JSON✯Atomic Implementation Plan: Focus on LLM Understanding

## Core Goal

**Reduce hallucinations and forgetting by giving LLMs clear, structured, self-describing data.**

## Why This Works

### The Problem (Current State)
```
LLM sees: { "kind": "tool_call", "payload": { "tool_id": "x", "result": "y" } }
LLM thinks: "What is this? Who did it? When? What does it mean?"
Result: Hallucinations, forgetting, confusion
```

### The Solution (JSON✯Atomic)
```
LLM sees: {
  "type": "tool.call@1.0.0",
  "body": { "tool_id": "x", "result": "y" },
  "meta": {
    "header": {
      "who": { "id": "agent.router", "role": "agent" },
      "did": "call_tool",
      "this": { "id": "step-123" },
      "when": { "ts": "2024-..." }
    },
    "trace_id": "run-456"
  }
}
LLM thinks: "Agent router called tool x in step-123 during run-456"
Result: Clear understanding, less hallucinations, better memory
```

## Implementation Strategy

### Phase 1: Atomic Event Converter (Core)

**Purpose**: Convert our events/steps to JSON✯Atomic format for LLM consumption.

**File**: `backend/src/agents/atomic-event-converter.service.ts`

**Key Features**:
1. Convert `Event` → JSON✯Atomic format
2. Convert `Step` → JSON✯Atomic format
3. Convert `Run` → JSON✯Atomic format
4. Build atomic context chains (prev_hash linking)

**Focus Areas**:
- ✅ **Clear type system** (`type@version`) - LLM knows what it's looking at
- ✅ **Rich metadata** (who, what, when) - LLM understands context
- ✅ **Traceability** (trace_id, context_id) - LLM can follow the chain
- ⏸️ **Conditional logic** (if_ok, if_doubt) - Phase 2
- ⏸️ **Crypto hashing** - Phase 2 (if needed)

### Phase 2: Integrate with Context Summarizer

**Purpose**: Use atomic format in context building for LLMs.

**Changes to**: `backend/src/agents/context-summarizer.service.ts`

**Before**:
```typescript
// Raw JSON dump
`Previous steps:\n${JSON.stringify(context.previousSteps, null, 2)}`
```

**After**:
```typescript
// Atomic format - clear, structured, self-describing
const atomicSteps = steps.map(s => atomicConverter.convertStep(s));
`Previous steps (in atomic format):\n${JSON.stringify(atomicSteps, null, 2)}`
```

### Phase 3: Atomic Format in Prompts

**Purpose**: Present atomic format to LLMs in all prompts.

**Changes to**: 
- `backend/src/agents/agent-runtime.service.ts` - Use atomic format in prompts
- `backend/src/execution/orchestrator.service.ts` - Use atomic format for routing context

**Benefits**:
- LLMs see structured, self-describing data
- Less confusion = less hallucinations
- Better memory = less forgetting

## Implementation Details

### 1. Atomic Event Converter Service

```typescript
@Injectable()
export class AtomicEventConverterService {
  /**
   * Convert Event to JSON✯Atomic format
   */
  convertEvent(
    event: Event,
    run: Run,
    step?: Step,
    previousHash?: string
  ): AtomicEvent {
    return {
      type: `event.${event.kind}@1.0.0`,
      schema_id: `event.${event.kind}@1.0.0`,
      body: event.payload,
      meta: {
        header: {
          who: {
            id: this.extractActorId(event, run, step),
            role: this.extractActorRole(event, run, step),
            key_id: run.user_id || run.tenant_id,
          },
          did: this.extractAction(event),
          this: { id: event.id },
          when: {
            ts: event.ts.toISOString(),
            recv_ts: event.ts.toISOString(),
            commit_ts: event.ts.toISOString(),
          },
          status: this.extractStatus(event, run),
        },
        trace_id: run.id,
        context_id: step?.id || run.id,
        owner_id: run.tenant_id,
        version: '1.0.0',
      },
      hash: this.computeHash(event, previousHash),
      prev_hash: previousHash,
    };
  }

  /**
   * Convert Step to JSON✯Atomic format
   */
  convertStep(step: Step, run: Run, previousHash?: string): AtomicStep {
    return {
      type: `step.${step.type}@1.0.0`,
      schema_id: `step.${step.type}@1.0.0`,
      body: {
        node_id: step.node_id,
        input: step.input,
        output: step.output,
        status: step.status,
      },
      meta: {
        header: {
          who: {
            id: this.extractStepActor(step),
            role: 'step',
            key_id: run.tenant_id,
          },
          did: `execute_${step.type}_node`,
          this: { id: step.id, node_id: step.node_id },
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
      prev_hash: previousHash,
    };
  }

  /**
   * Build atomic context chain (with prev_hash linking)
   */
  buildAtomicContextChain(
    steps: Step[],
    events: Event[],
    run: Run
  ): AtomicContext {
    const atomicSteps = steps.map((step, index) => {
      const prevHash = index > 0 ? this.computeHash(steps[index - 1]) : undefined;
      return this.convertStep(step, run, prevHash);
    });

    const atomicEvents = events.map((event, index) => {
      const prevHash = index > 0 ? this.computeHash(events[index - 1]) : undefined;
      return this.convertEvent(event, run, undefined, prevHash);
    });

    return {
      run_id: run.id,
      steps: atomicSteps,
      events: atomicEvents,
    };
  }

  private computeHash(item: any, prevHash?: string): string {
    // Simple hash for now (can enhance with crypto later)
    const content = JSON.stringify(item) + (prevHash || '');
    return this.simpleHash(content);
  }

  private simpleHash(str: string): string {
    // Placeholder - can use crypto.createHash('sha256') later
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  private extractActorId(event: Event, run: Run, step?: Step): string {
    // Extract who performed this action
    if (event.kind === EventKind.LLM_CALL) {
      return event.payload.agent_id || 'unknown';
    }
    if (event.kind === EventKind.TOOL_CALL) {
      return event.payload.agent_id || step?.type || 'system';
    }
    return 'system';
  }

  private extractActorRole(event: Event, run: Run, step?: Step): string {
    if (event.kind === EventKind.LLM_CALL) return 'agent';
    if (event.kind === EventKind.TOOL_CALL) return 'agent';
    return 'system';
  }

  private extractAction(event: Event): string {
    return event.kind.replace(/_/g, ' ');
  }

  private extractStatus(event: Event, run: Run): 'APPROVE' | 'REVIEW' | 'DENY' {
    // Map event/run status to atomic status
    if (run.mode === 'auto') return 'APPROVE';
    if (run.mode === 'draft') return 'REVIEW';
    return 'APPROVE';
  }

  private extractStepActor(step: Step): string {
    return step.type === 'agent' ? 'agent' : step.type;
  }

  private mapStepStatusToAtomic(status: StepStatus): 'APPROVE' | 'REVIEW' | 'DENY' {
    if (status === StepStatus.COMPLETED) return 'APPROVE';
    if (status === StepStatus.FAILED) return 'DENY';
    return 'REVIEW';
  }
}
```

### 2. Update Context Summarizer

```typescript
// In context-summarizer.service.ts

constructor(
  private atomicConverter: AtomicEventConverterService,
) {}

summarizePreviousSteps(steps: Array<{ node_id: string; output?: any }>): string {
  // Convert to atomic format first
  const atomicSteps = steps.map(step => 
    this.atomicConverter.convertStep(step, run)
  );
  
  // Then summarize in natural language
  return `Here's what we've accomplished (in structured format):
${JSON.stringify(atomicSteps, null, 2)}

Summary:
${this.buildNaturalLanguageSummary(atomicSteps)}`;
}
```

### 3. Update Agent Runtime

```typescript
// In agent-runtime.service.ts

private buildPrompt(agent: Agent, context: AgentContext, input?: any): CoreMessage[] {
  // Convert context to atomic format
  const atomicContext = this.atomicConverter.buildAtomicContextChain(
    context.previousSteps,
    context.events || [],
    context.run
  );

  const messages: CoreMessage[] = [
    {
      role: 'system',
      content: agent.instructions,
    },
    {
      role: 'user',
      content: `Here's the execution context in structured format:

${JSON.stringify(atomicContext, null, 2)}

This format helps you understand:
- Who did what (meta.header.who)
- When it happened (meta.header.when)
- What the result was (body)
- How it connects (trace_id, context_id, prev_hash)

Use this structured information to make informed decisions.`,
    },
  ];

  return messages;
}
```

## Benefits for LLM Understanding

### 1. **Self-Describing Structure**
```
type: "step.agent@1.0.0"
→ LLM knows: "This is an agent step execution"
```

### 2. **Clear Actor Identification**
```
meta.header.who: { id: "agent.router", role: "agent" }
→ LLM knows: "Agent router did this"
```

### 3. **Temporal Context**
```
meta.header.when: { ts: "...", recv_ts: "...", commit_ts: "..." }
→ LLM knows: "This happened at this time"
```

### 4. **Traceability**
```
trace_id: "run-123"
context_id: "step-456"
prev_hash: "abc..."
→ LLM knows: "This connects to that"
```

### 5. **Structured Body**
```
body: { input: {...}, output: {...} }
→ LLM knows: "This is the actual data"
```

## Expected Impact

### Before (Current)
- ❌ LLM sees: `{ "kind": "tool_call", "payload": {...} }`
- ❌ LLM thinks: "What is this? Who did it?"
- ❌ Result: Hallucinations, forgetting

### After (Atomic Format)
- ✅ LLM sees: Structured, self-describing format
- ✅ LLM thinks: "Agent router called tool X in step Y during run Z"
- ✅ Result: Clear understanding, less hallucinations, better memory

## Implementation Priority

1. **Phase 1** (Immediate): Atomic Event Converter Service
2. **Phase 2** (Next): Integrate with Context Summarizer
3. **Phase 3** (Next): Use in all prompts
4. **Phase 4** (Future): Conditional logic (if_ok, if_doubt)
5. **Phase 5** (Future): Crypto hashing (if needed)

## Success Metrics

- ✅ LLMs understand context better (measured by fewer clarification requests)
- ✅ Less hallucinations (measured by fewer incorrect assumptions)
- ✅ Better memory (measured by LLMs referencing previous steps correctly)
- ✅ Clearer reasoning (measured by more accurate routing/decisions)

---

## Ready to Implement?

This focused approach will:
1. ✅ Give LLMs clear, structured data
2. ✅ Reduce hallucinations
3. ✅ Prevent forgetting
4. ✅ Improve understanding

Should we proceed with Phase 1 (Atomic Event Converter)?

