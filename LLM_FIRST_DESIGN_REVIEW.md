# LLM-First Design Review

## Executive Summary

**Status**: ⚠️ **Partially Compliant** - Core LLM infrastructure is solid, but some design decisions deviate from LLM-first principles.

**Key Findings**:
- ✅ **Strong**: Agent runtime, LLM router, tool calling via agents
- ⚠️ **Needs Improvement**: Router nodes, direct tool calls, conditional logic
- ❌ **Missing**: Natural language workflow definition, LLM-powered routing

---

## LLM-First Design Principles

### Core Principle
> **LLMs should be the primary decision-makers in the system. Agents (LLM-powered) should handle routing, decisions, conditional logic, and tool selection.**

### Key Tenets

1. **Agents Make Decisions**: Routing, conditionals, and tool selection should be LLM-powered
2. **Tools Called by Agents**: Tools should primarily be invoked by agents, not directly by workflows
3. **Natural Language First**: Natural language should be a first-class interface for configuration and interaction
4. **LLM-Powered Routing**: Conditional logic and routing should use agents, not hardcoded rules
5. **Intelligent Orchestration**: The orchestrator should leverage LLMs for complex decisions

---

## Current Implementation Analysis

### ✅ **COMPLIANT: Core LLM Infrastructure**

#### 1. Agent Runtime Service
**File**: `backend/src/agents/agent-runtime.service.ts`

**Status**: ✅ **Excellent**

- Uses LLM Router for all agent decisions
- Implements tool calling via AI SDK
- Agents can call tools dynamically
- Proper prompt building with context
- Full traceability of LLM calls

**LLM-First Score**: 10/10

#### 2. LLM Router Service
**File**: `backend/src/llm/llm-router.service.ts`

**Status**: ✅ **Excellent**

- Unified interface for multiple providers
- Streaming support
- Tool calling support
- Proper abstraction layer

**LLM-First Score**: 10/10

#### 3. Natural Language DB Tools
**File**: `backend/src/tools/natural-language-db.tool.ts`

**Status**: ✅ **Excellent**

- Natural language → SQL conversion via LLM
- Read and write operations
- Security checks in place
- Dry-run mode

**LLM-First Score**: 10/10

#### 4. Agent Conversation Endpoint
**File**: `backend/src/agents/agents.controller.ts`

**Status**: ✅ **Good**

- Direct agent interaction
- Streaming support
- Full traceability

**LLM-First Score**: 9/10

---

### ⚠️ **NEEDS IMPROVEMENT: Orchestration & Routing**

#### 1. Router Nodes (NOT LLM-Powered)
**File**: `backend/src/execution/orchestrator.service.ts` (lines 203-207)

**Current Implementation**:
```typescript
case 'router':
case 'human_gate':
  // Placeholder for future implementation
  output = { message: `Node type ${node.type} not yet implemented` };
  break;
```

**Issue**: Router nodes should use **agents** to make routing decisions, not hardcoded conditions.

**LLM-First Violation**: 
- ❌ Routing decisions should be LLM-powered
- ❌ Conditional logic should use agents
- ❌ No natural language condition evaluation

**Recommended Fix**:
```typescript
case 'router':
  // Use an agent to determine routing
  const routerAgentId = node.config?.router_agent_id || 'agent.router';
  const routingContext = {
    ...context,
    previousStepOutput: previousStep?.output,
    availableRoutes: node.config?.routes || [],
  };
  const routingDecision = await this.agentRuntime.runAgentStep(
    routerAgentId,
    routingContext,
    `Determine which route to take based on: ${JSON.stringify(previousStep?.output)}`
  );
  // Parse routing decision and follow appropriate edge
  break;
```

**LLM-First Score**: 2/10 (not implemented, but design is wrong)

#### 2. Direct Tool Calls in Workflows
**File**: `backend/src/execution/orchestrator.service.ts` (lines 287-314)

**Current Implementation**:
```typescript
case 'tool':
  output = await this.executeToolNode(runId, savedStep.id, node, run);
  break;
```

**Issue**: In LLM-first design, tools should primarily be called **by agents**, not directly by workflows.

**LLM-First Violation**:
- ⚠️ Tools can be called directly without agent decision
- ⚠️ Bypasses LLM reasoning for tool selection

**Recommended Approach**:
- Keep `tool_node` for explicit tool calls (sometimes needed)
- But **prefer** `agent_node` that calls tools via LLM decision
- Add warning/flag when using direct tool calls

**LLM-First Score**: 6/10 (functional but not ideal)

#### 3. Conditional Edge Logic
**File**: `backend/src/execution/orchestrator.service.ts` (lines 123-156)

**Current Implementation**:
```typescript
// Simple linear traversal - no conditional logic
const edges = definition.edges || [];
while (true) {
  const nextEdge = edges.find((e) => e.from === currentNode);
  if (!nextEdge) break;
  executionOrder.push(nextEdge.to);
  currentNode = nextEdge.to;
}
```

**Issue**: Edge conditions (if they exist) are not evaluated. Should use agents to evaluate conditions.

**LLM-First Violation**:
- ❌ No conditional edge evaluation
- ❌ No LLM-powered condition checking

**Recommended Fix**:
```typescript
// Evaluate edge conditions using agents
for (const edge of edges) {
  if (edge.from === currentNode) {
    if (edge.condition) {
      // Use agent to evaluate condition
      const conditionResult = await this.evaluateCondition(
        edge.condition,
        previousStepOutput,
        context
      );
      if (conditionResult) {
        executionOrder.push(edge.to);
        break;
      }
    } else {
      // No condition, follow edge
      executionOrder.push(edge.to);
      break;
    }
  }
}
```

**LLM-First Score**: 3/10 (no conditional logic implemented)

---

### ❌ **MISSING: Natural Language Features**

#### 1. Natural Language Workflow Definition
**Status**: ❌ **Not Implemented**

**Issue**: Workflows must be defined in JSON. No natural language interface.

**LLM-First Violation**:
- ❌ No natural language → workflow conversion
- ❌ No "describe what you want" interface

**Recommended Addition**:
```typescript
POST /workflows/from-natural-language
Body: { description: "Create a workflow that fetches tickets and triages them" }
Response: { workflow: WorkflowDefinition }
```

**LLM-First Score**: 0/10

#### 2. Natural Language Tool Discovery
**Status**: ⚠️ **Partial**

**Issue**: Tools must be explicitly referenced. No "find the right tool" capability.

**LLM-First Violation**:
- ⚠️ Agents can only use explicitly allowed tools
- ⚠️ No semantic tool discovery

**Recommended Addition**:
- Tool descriptions should be searchable
- Agents should be able to discover tools via natural language
- "Find a tool that can query the database" → returns `natural_language_db_read`

**LLM-First Score**: 5/10

---

## Blueprint Compliance Check

### ✅ **Following Blueprint**

1. **Agent Runtime** - ✅ Matches blueprint spec
2. **LLM Router** - ✅ Matches blueprint spec
3. **Tool Runtime** - ✅ Matches blueprint spec
4. **Natural Language DB Tools** - ✅ Matches blueprint spec
5. **Workflow Execution** - ✅ Matches blueprint structure
6. **App Platform** - ✅ Matches blueprint spec

### ⚠️ **Blueprint Deviations**

1. **Router Nodes** - Blueprint says "conditional routing based on step output" but doesn't specify LLM-powered. **Should clarify in blueprint**.
2. **Tool Nodes** - Blueprint allows direct tool calls. **Acceptable but not ideal for LLM-first**.
3. **Conditional Edges** - Blueprint mentions `condition?: string` but doesn't specify how to evaluate. **Should use agents**.

### ❌ **Blueprint Missing**

1. **Natural Language Workflow Definition** - Not in blueprint, but should be for LLM-first design
2. **LLM-Powered Routing** - Blueprint doesn't explicitly state routers should use agents
3. **Semantic Tool Discovery** - Not in blueprint

---

## Recommendations

### Priority 1: Critical LLM-First Improvements

1. **Implement LLM-Powered Router Nodes**
   - Router nodes should use agents to make routing decisions
   - Natural language conditions: "if the ticket priority is high"
   - Agent evaluates condition and returns route

2. **Implement Conditional Edge Evaluation**
   - Edges with `condition` should use agents to evaluate
   - Natural language conditions supported

3. **Add Natural Language Workflow Definition**
   - `POST /workflows/from-natural-language`
   - LLM converts description → workflow definition
   - User can refine via conversation

### Priority 2: Enhancements

4. **Semantic Tool Discovery**
   - Agents can discover tools via natural language
   - Tool descriptions indexed for semantic search
   - "Find a tool that can..." → returns relevant tools

5. **LLM-Powered Human Gate Decisions**
   - Human gates should use agents to determine if human input is needed
   - Agent evaluates: "Does this require human approval?"

6. **Natural Language Workflow Modification**
   - "Add a step that sends an email after triage"
   - LLM modifies workflow definition

### Priority 3: Documentation

7. **Update Blueprint**
   - Clarify that router nodes should use agents
   - Specify that conditional edges use agents
   - Add natural language workflow definition to roadmap

---

## Updated Blueprint Sections Needed

### Section 5.1: Workflow Definition Spec

**Add**:
```typescript
interface RouterNode {
  id: string;
  type: 'router';
  config: {
    router_agent_id: string; // Agent that makes routing decision
    routes: Array<{
      id: string;
      condition?: string; // Natural language condition
      target_node: string;
    }>;
  };
}
```

### Section 5.4: Natural Language Workflow Definition

**Add new section**:
```markdown
### 5.4. Natural Language Workflow Definition

Workflows can be defined via natural language:

POST /workflows/from-natural-language
Body: {
  "description": "Create a workflow that fetches open tickets, triages them using an agent, and sends high-priority tickets to a human reviewer"
}

The LLM converts this to a workflow definition, which can be refined via conversation.
```

### Section 6.3: LLM-Powered Routing

**Add new section**:
```markdown
### 6.3. LLM-Powered Routing

Router nodes use agents to make routing decisions:

- Router agent receives: previous step output, available routes, context
- Agent evaluates conditions in natural language
- Agent returns: selected route ID
- Orchestrator follows selected route

This ensures all routing decisions are LLM-powered and explainable.
```

---

## Implementation Priority

1. **Immediate** (Before testing):
   - Update blueprint with LLM-first clarifications
   - Document router node implementation plan

2. **Phase 3.5** (After Phase 3):
   - Implement LLM-powered router nodes
   - Implement conditional edge evaluation

3. **Phase 4** (Memory & Governance):
   - Natural language workflow definition
   - Semantic tool discovery

---

## Conclusion

**Overall LLM-First Score**: 7.5/10

**Strengths**:
- Core LLM infrastructure is excellent
- Agents properly use LLMs for decisions
- Natural language DB tools are well-implemented

**Weaknesses**:
- Router nodes not implemented (and design is not LLM-first)
- Direct tool calls bypass LLM reasoning
- No natural language workflow definition

**Action Items**:
1. Update blueprint to clarify LLM-first routing
2. Plan router node implementation with agents
3. Consider deprecating direct tool nodes in favor of agent-driven tool calls

