# Agent UI Architecture

## Key Principle: Agents Don't Have a UI

**Agents are backend execution components. They don't have a UI themselves.**

Our backend is **UI-agnostic**. It provides APIs that any frontend can call.

## How Agents Work

### 1. Agents Execute in Two Contexts

#### A. Inside Workflows (Orchestrated)
```
Frontend → POST /apps/:app_id/actions/:action_id
  ↓
App Runtime → Resolves Workflow
  ↓
Orchestrator → Executes Workflow Nodes
  ↓
Agent Node → AgentRuntimeService.runAgentStep()
  ↓
LLM + Tools → Result
```

**Where:** Agents run as `agent_node` in workflows, orchestrated by the OrchestratorService.

**UI:** The frontend doesn't interact with agents directly. It calls app actions, which trigger workflows, which may contain agent nodes.

#### B. Direct Conversation (Streaming)
```
Frontend → POST /agents/:id/conversation
  ↓
AgentsController → Creates Run & Step
  ↓
AgentRuntimeService.runAgentStep()
  ↓
Streams Response (SSE)
```

**Where:** Direct agent conversations via the conversation endpoint.

**UI:** Frontend can implement any chat interface that calls this endpoint and handles SSE streaming.

### 2. UI is App-Based, Not Agent-Based

**Our backend expects:**

1. **App Actions API** (Preferred):
   - Frontend calls `POST /apps/:app_id/actions/:action_id`
   - Backend resolves action → workflow → executes
   - If workflow contains agent nodes, agents execute automatically
   - Frontend streams run updates via `GET /runs/:id/stream`

2. **Direct Agent Calls** (Alternative):
   - Frontend calls `POST /agents/:id/conversation`
   - For conversational use cases
   - Backend handles run/step creation automatically

**What UI can look like:**
- Chat interface (like we created in examples)
- Dashboard with buttons/forms
- Code editor with agent integration
- Any UI that calls our APIs

### 3. Agent Execution Flow

```
┌─────────────────────────────────────────┐
│  Frontend (Any UI)                      │
│  - Chat panel                           │
│  - Dashboard                            │
│  - Code editor                          │
│  - Custom UI                            │
└──────────────┬──────────────────────────┘
               │
               │ POST /apps/:id/actions/:action_id
               │ OR
               │ POST /agents/:id/conversation
               │
               ▼
┌─────────────────────────────────────────┐
│  Backend APIs                            │
│  - App Runtime API                      │
│  - Agent Conversation API                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Orchestrator                            │
│  - Executes workflows                   │
│  - Creates runs/steps/events            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Agent Runtime (Backend Only)           │
│  - No UI                                 │
│  - Executes agent logic                 │
│  - Calls LLM via AI SDK                 │
│  - Executes tools                       │
└─────────────────────────────────────────┘
```

## What Our Backend Provides

### APIs (UI-Agnostic)

1. **App Actions API**:
   - `POST /apps/:app_id/actions/:action_id`
   - Returns: `{ run_id, status, workflow_id }`
   - Frontend then streams: `GET /runs/:id/stream`

2. **Agent Conversation API**:
   - `POST /agents/:id/conversation`
   - Returns: SSE stream with agent responses
   - For direct conversational interactions

3. **Run/Trace API**:
   - `GET /runs/:id` - Get run details
   - `GET /runs/:id/events` - Get full trace
   - `GET /runs/:id/stream` - Stream updates (SSE)

### What Frontend Needs to Implement

**Any UI that:**
1. Calls our APIs (app actions or direct agent calls)
2. Handles SSE streaming for real-time updates
3. Displays results and traces

**Examples:**
- Chat interface (like ConversationPanel)
- Dashboard with action buttons
- Code editor with agent integration
- Custom business UI

## Where Agents Execute

### Context 1: Workflow Execution (Orchestrated)

**File:** `backend/src/execution/orchestrator.service.ts`

```typescript
// When orchestrator encounters agent_node
case 'agent':
  output = await this.executeAgentNode(runId, stepId, node, run);
  break;
```

**Execution:**
- Agent runs as part of a workflow
- Orchestrator manages the execution
- Full traceability (runs, steps, events)
- Frontend doesn't know agents are involved

### Context 2: Direct Conversation (Streaming)

**File:** `backend/src/agents/agents.controller.ts`

```typescript
@Post(':id/conversation')
async conversation(...) {
  // Creates run & step
  // Calls AgentRuntimeService.runAgentStep()
  // Streams response
}
```

**Execution:**
- Direct agent invocation
- Creates run/step automatically
- Streams response via SSE
- Frontend handles streaming

## UI Expectations

### Our Backend Expects:

**Nothing specific about UI.** It's completely UI-agnostic.

**What it provides:**
- REST APIs for app actions
- SSE streaming for real-time updates
- Run/trace APIs for observability

**What frontend can be:**
- Next.js app (like template)
- React app
- Vue app
- Any HTTP client that can call our APIs

### Recommended UI Pattern

Based on the blueprint's "Experience Plane":

1. **App Shell**:
   - App switcher (list of apps)
   - View renderer (chat, dashboard, trace viewer)
   - Settings & profile

2. **App Page**:
   - Shows app actions (buttons, forms, etc.)
   - Calls `POST /apps/:app_id/actions/:action_id`
   - Displays results and traces

3. **Trace Viewer**:
   - Shows run details
   - Displays events (tool calls, LLM calls)
   - Visualizes workflow execution

## Example: Template Frontend as App

The template frontend:
1. Registers as app: `coding-agent-frontend`
2. Defines actions: `start_conversation`, `execute_code_agent`
3. Implements UI: Chat panel, code editor, etc.
4. Calls APIs: `POST /apps/coding-agent-frontend/actions/start_conversation`

The backend:
- Doesn't care what the UI looks like
- Just executes the action → workflow → agent
- Returns results and streams updates

## Summary

**Agents are backend execution components. They don't have a UI.**

**Our backend is UI-agnostic. It provides APIs that any frontend can use.**

**The frontend can be:**
- Chat interface
- Dashboard
- Code editor
- Custom business UI
- Any UI that calls our APIs

**Agents execute:**
- Inside workflows (orchestrated by orchestrator)
- Via direct conversation endpoint (streaming)

**Frontend interacts with:**
- App actions (preferred)
- Direct agent calls (alternative)
- Run/trace APIs (for observability)

