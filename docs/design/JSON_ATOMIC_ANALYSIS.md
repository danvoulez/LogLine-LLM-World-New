# JSON✯Atomic Format Analysis

## What This Format Provides

### 1. **Structured Type System**
```json
"type": "step.execution@1.0.0"
"schema_id": "step.execution@1.0.0"
```
- Clear versioning (`type@version` pattern)
- LLMs can understand structure from type
- Self-describing format

### 2. **Rich Metadata (Who, What, When, Why)**
```json
"meta": {
  "header": {
    "who": { "id": "agent.router", "role": "agent", "key_id": "..." },
    "did": "route_decision",
    "this": { "id": "step-123" },
    "when": { "ts": "...", "recv_ts": "...", "commit_ts": "..." },
    "status": "APPROVE" | "REVIEW" | "DENY"
  }
}
```
- **Who**: Clear actor identification
- **What**: Action description
- **When**: Precise timing (created, received, committed)
- **Status**: Approval workflow built-in

### 3. **Conditional Logic**
```json
"if_ok": { ... },
"if_doubt": { ... },
"if_not": { ... }
```
- Built-in conditional handling
- LLMs can reason about outcomes
- Natural language conditions

### 4. **Traceability**
```json
"trace_id": "run-123",
"context_id": "workflow-context-456"
```
- Full trace chain
- Context linking
- Easy to follow execution path

### 5. **Cryptographic Integrity**
```json
"hash": "sha256...",
"prev_hash": "sha256...",
"signature": "..."
```
- Verifiable chain
- Tamper-proof
- Audit trail

### 6. **Attachments**
```json
"attachments": [
  { "name": "file.ts", "mime": "text/typescript", "sha256": "...", "bytes": 1024 }
]
```
- File references with integrity
- Content-addressed storage
- LLM can reference files by hash

---

## How This Could Help Our System

### Current Issues

1. **Events are unstructured**:
   ```typescript
   { kind: 'tool_call', payload: { ... } }
   // LLM sees: generic JSON blob
   ```

2. **No clear "who did what"**:
   - Events don't clearly identify the actor
   - Hard for LLM to understand context

3. **No conditional logic structure**:
   - `if_ok`, `if_doubt`, `if_not` would help LLMs reason

4. **No approval workflow**:
   - Human gates need `status: APPROVE|REVIEW|DENY`

5. **No cryptographic integrity**:
   - Can't verify event chain
   - No tamper-proof audit trail

### Potential Benefits

#### 1. **LLM-Friendly Structure**
- LLMs can understand structure from `type@version`
- Self-describing format
- Clear semantic meaning

#### 2. **Better Context for AI Partners**
```json
{
  "type": "step.execution@1.0.0",
  "body": { "output": "..." },
  "meta": {
    "header": {
      "who": { "id": "agent.router", "role": "agent" },
      "did": "evaluate_routing",
      "this": { "id": "step-123" }
    }
  }
}
```

**LLM sees**: "Agent router evaluated routing for step-123"
**Instead of**: Generic JSON blob

#### 3. **Natural Conditional Logic**
```json
{
  "if_ok": { "next_step": "approve" },
  "if_doubt": { "next_step": "review" },
  "if_not": { "next_step": "reject" }
}
```

LLM can reason: "If the condition is OK, do X. If there's doubt, do Y."

#### 4. **Built-in Approval Workflow**
```json
{
  "status": "REVIEW",
  "confirmed_by": [
    { "key_id": "user-123", "signature": "..." }
  ]
}
```

Perfect for human gates!

#### 5. **Verifiable Chain**
```json
{
  "hash": "current",
  "prev_hash": "previous"
}
```

LLM can verify: "This event follows that event"

---

## Integration Options

### Option 1: **Wrap Existing Events** (Non-Breaking)

Keep current structure, wrap in JSON✯Atomic format:

```typescript
// Current
event.payload = { tool_id: '...', result: '...' }

// Wrapped
event.payload = {
  type: 'tool.call@1.0.0',
  body: { tool_id: '...', result: '...' },
  meta: {
    header: {
      who: { id: 'agent.test', role: 'agent' },
      did: 'call_tool',
      this: { id: event.id },
      when: { ts: event.ts, recv_ts: event.ts, commit_ts: event.ts },
      status: 'APPROVE'
    },
    trace_id: event.run_id,
    context_id: event.step_id,
    owner_id: run.tenant_id,
    version: '1.0.0'
  },
  hash: computeHash(event),
  prev_hash: previousEvent?.hash
}
```

**Pros**:
- ✅ Non-breaking
- ✅ Can migrate gradually
- ✅ LLMs get better structure

**Cons**:
- ⚠️ Adds complexity
- ⚠️ Duplicate data

### Option 2: **Native JSON✯Atomic Events** (Breaking)

Replace current event structure with JSON✯Atomic:

```typescript
// New structure
event.atomic = {
  type: 'step.execution@1.0.0',
  body: { ... },
  meta: { ... },
  hash: '...',
  prev_hash: '...'
}
```

**Pros**:
- ✅ Clean, consistent format
- ✅ LLM-friendly from the start
- ✅ Built-in approval workflow

**Cons**:
- ⚠️ Breaking change
- ⚠️ Migration needed

### Option 3: **Hybrid: JSON✯Atomic for LLM Context** (Recommended)

Keep database structure, convert to JSON✯Atomic for LLM consumption:

```typescript
// Store in DB as-is
event.payload = { ... }

// Convert to JSON✯Atomic when sending to LLM
const atomicEvent = convertToAtomic(event, run, step);
// LLM receives structured, dignified format
```

**Pros**:
- ✅ Best of both worlds
- ✅ Non-breaking
- ✅ LLM gets structured format
- ✅ Database stays simple

**Cons**:
- ⚠️ Conversion layer needed

---

## Questions to Discuss

### 1. **Scope**
- Should we use JSON✯Atomic for:
  - ✅ Events only?
  - ✅ Steps too?
  - ✅ Runs?
  - ✅ All of the above?

### 2. **Integration Level**
- **Option A**: Wrapper layer (convert to atomic for LLM)
- **Option B**: Native storage (store as atomic)
- **Option C**: Hybrid (store simple, convert for LLM)

### 3. **Approval Workflow**
- Should we use `status: APPROVE|REVIEW|DENY` for human gates?
- How does this integrate with our current `mode: draft|auto`?

### 4. **Conditional Logic**
- Should `if_ok`, `if_doubt`, `if_not` replace our conditional edges?
- Or complement them?

### 5. **Cryptographic Integrity**
- Do we need `hash`, `prev_hash`, `signature`?
- For audit trail? For security? For LLM verification?

### 6. **Attachments**
- Should file references use JSON✯Atomic attachments?
- Link to our file storage API?

---

## My Recommendation

**Hybrid Approach (Option 3)**:

1. **Keep database structure simple** (current events/steps/runs)
2. **Convert to JSON✯Atomic for LLM context**:
   - When building prompts
   - When streaming events
   - When summarizing context
3. **Use JSON✯Atomic structure for**:
   - Human gate approvals (`status: REVIEW`)
   - Conditional logic (`if_ok`, `if_doubt`, `if_not`)
   - LLM-friendly event presentation

**Benefits**:
- ✅ LLMs get structured, dignified format
- ✅ Database stays simple and performant
- ✅ Non-breaking change
- ✅ Can migrate gradually

**Implementation**:
- Create `AtomicEventConverter` service
- Converts events → JSON✯Atomic format
- Used in context summarizer
- Used in prompt building

---

## What Do You Think?

1. **What was most helpful about JSON✯Atomic in your previous project?**
   - Structure clarity?
   - LLM understanding?
   - Conditional logic?
   - Approval workflow?

2. **What should we prioritize?**
   - LLM-friendly structure?
   - Approval workflow?
   - Conditional logic?
   - Cryptographic integrity?

3. **Integration approach?**
   - Wrapper (convert for LLM)?
   - Native (store as atomic)?
   - Hybrid (both)?

Let's discuss before implementing! 🎯

