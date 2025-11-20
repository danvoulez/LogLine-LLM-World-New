# TDLN-T Integration Plan: True LLM-Engine Architecture

## Core Philosophy

> **Use TDLN-T for deterministic, repetitive tasks (cost savings). Use LLMs only when truly needed (complex reasoning). This creates a true LLM-Engine.**

## Architecture Decision

### Decision Flow

```
Text Input
    ↓
Is it deterministic/trivial?
    ├─ YES → TDLN-T (no LLM, cost = $0)
    └─ NO → LLM (complex reasoning, cost = $X)
```

### Integration Points

1. **Pre-Processing Layer**: Refract all text before LLM
   - Structured semantic components help LLM understand
   - Reduces hallucinations
   - Better context

2. **Deterministic Translation**: Use TDLN-T directly
   - Multi-language agent instructions
   - Tool descriptions
   - Error messages
   - No LLM needed = cost savings

3. **Complex Cases**: Use LLM with refracted context
   - Complex reasoning
   - Context-dependent decisions
   - Creative tasks

## Implementation Plan

### Phase 1: Core TDLN-T Service

**File**: `backend/src/tdln-t/tdln-t.service.ts`

**Core Methods**:
- `refract(text, grammar)` - Break text into semantic components
- `transmute(refracted, sourceGrammar, targetGrammar)` - Transform
- `project(refracted)` - Reconstruct text
- `translate(text, sourceGrammar, targetGrammar)` - Full pipeline

**Grammar Definitions**:
- `grammar_en_us_strict.json`
- `grammar_pt_br_strict.json`
- Extensible for more languages

### Phase 2: Integration with Agent Runtime

**Decision Logic**:
```typescript
// In AgentRuntimeService
async runAgentStep(agentId, context, input) {
  // 1. Refract input text (for structure)
  const refractedInput = await tdlnTService.refract(input, 'en_us');
  
  // 2. Check if task is deterministic
  if (isDeterministicTask(input)) {
    // Use TDLN-T directly (no LLM)
    return await tdlnTService.handleDeterministicTask(refractedInput);
  }
  
  // 3. Use LLM with refracted context
  const messages = await this.buildPrompt(agent, context, refractedInput);
  return await this.llmRouter.generateText(...);
}
```

### Phase 3: Pre-Processing Layer

**All Text → Refracted Before LLM**:
- Tool results
- Agent instructions
- Error messages
- User inputs

**Benefits**:
- LLMs see structured components
- Better understanding
- Reduced hallucinations

### Phase 4: Deterministic Translation Tool

**Tool**: `tdln_t.translate`

**Use Cases**:
- Translate agent instructions
- Translate tool descriptions
- Translate error messages
- No LLM needed = cost savings

## Cost Analysis

### Before (LLM-Only)

```
1000 translations/day × $0.01/call = $10/day = $300/month
```

### After (TDLN-T + LLM)

```
800 deterministic translations/day × $0 (TDLN-T) = $0
200 complex translations/day × $0.01/call = $2/day = $60/month

Savings: $240/month (80% reduction)
```

## Implementation Details

### 1. TDLN-T Service Structure

```typescript
@Injectable()
export class TdlnTService {
  // Core operations
  async refract(text: string, grammar: string): Promise<RefractedToken[]>
  async transmute(refracted: RefractedToken[], sourceGrammar: string, targetGrammar: string): Promise<RefractedToken[]>
  async project(refracted: RefractedToken[]): Promise<string>
  async translate(text: string, sourceGrammar: string, targetGrammar: string): Promise<string>
  
  // Decision logic
  isDeterministicTask(input: any): boolean
  async handleDeterministicTask(refracted: RefractedToken[]): Promise<any>
  
  // Grammar management
  loadGrammar(grammarId: string): Promise<Grammar>
  getAvailableGrammars(): string[]
}
```

### 2. Integration with Atomic Format

```typescript
// Refract text in atomic events before sending to LLM
const atomicEvent = {
  type: 'event.tool_call@1.0.0',
  body: {
    tool_id: 'test',
    result: 'Error: Network 10.0.0.1 failed',
    result_refracted: [
      { frequency: 'F_KEY', value: 'Error', phase: 0 },
      { frequency: 'F_META', value: ':', phase: 1 },
      // ...
    ]
  }
}
```

### 3. Decision Layer

```typescript
function isDeterministicTask(input: any): boolean {
  // Deterministic if:
  // - Simple translation (dictionary lookup)
  // - Format conversion (JSON → YAML)
  // - Data extraction (structured patterns)
  // - Code formatting
  
  // NOT deterministic if:
  // - Complex reasoning required
  // - Context-dependent decisions
  // - Creative tasks
  
  return checkIfDeterministic(input);
}
```

## Use Cases

### 1. Multi-Language Agent Instructions

**Before** (LLM):
```
User: "Translate agent instructions to Portuguese"
LLM: [costs money, may hallucinate]
```

**After** (TDLN-T):
```
User: "Translate agent instructions to Portuguese"
TDLN-T: [deterministic, $0, no hallucinations]
```

### 2. Tool Result Preprocessing

**Before** (LLM sees raw text):
```
"Error: Network 10.0.0.1 failed"
LLM: [may misunderstand structure]
```

**After** (LLM sees refracted):
```
[
  { frequency: 'F_KEY', value: 'Error', phase: 0 },
  { frequency: 'F_NET', value: '10.0.0.1', phase: 5 },
  { frequency: 'F_KEY', value: 'failed', phase: 7 }
]
LLM: [understands structure clearly]
```

### 3. Deterministic Format Conversion

**Before** (LLM):
```
User: "Convert JSON to YAML"
LLM: [costs money, may make mistakes]
```

**After** (TDLN-T):
```
User: "Convert JSON to YAML"
TDLN-T: [deterministic, $0, always correct]
```

## Benefits

### 1. **Cost Savings** 💰
- 80%+ reduction in LLM calls
- Deterministic tasks = $0
- Only pay for complex reasoning

### 2. **Better LLM Understanding** 🧠
- Refracted text = structured components
- LLMs see clear semantic structure
- Reduced hallucinations

### 3. **True LLM-Engine** ⚙️
- LLMs only when needed
- Deterministic transformations when possible
- Best of both worlds

### 4. **Auditability** 📋
- TDLN-T transformations are fully traceable
- Can audit every step
- No black-box LLM calls for simple tasks

## Implementation Priority

1. **Phase 1** (Immediate): Core TDLN-T Service
2. **Phase 2** (Next): Integration with Agent Runtime
3. **Phase 3** (Next): Pre-processing layer
4. **Phase 4** (Future): Deterministic translation tool

## Success Metrics

- ✅ 80%+ reduction in LLM calls for deterministic tasks
- ✅ Better LLM understanding (measured by fewer hallucinations)
- ✅ Cost savings (measured by API usage)
- ✅ Faster responses for deterministic tasks
- ✅ Full auditability of transformations

---

**Ready to implement!** This will create a true LLM-Engine: deterministic when possible, LLM when needed.

