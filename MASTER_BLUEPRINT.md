# LogLine LLM World - Master Blueprint

> A **cloud‑native LLM-first Agent OS** + **App platform** built for Vercel deployment.

**Version:** 2.0  
**Last Updated:** 2024  
**Deployment Target:** Vercel (Serverless) + Vercel Postgres

---

## Table of Contents

1. [Purpose & Vision](#1-purpose--vision)
2. [Core Concepts (Glossary)](#2-core-concepts-glossary)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Model & Schema](#4-data-model--schema)
5. [Workflow Definition Spec](#5-workflow-definition-spec)
6. [Tools & Agents Design](#6-tools--agents-design)
7. [App Platform & Manifest Spec](#7-app-platform--manifest-spec)
8. [HTTP API Reference](#8-http-api-reference-mvp)
9. [Deployment & Environments (Vercel)](#9-deployment--environments-vercel)
10. [Observability, Testing & Maintenance](#10-observability-testing--maintenance)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [How to Extend the Platform Safely](#12-how-to-extend-the-platform-safely)

---

## 1. Purpose & Vision

### 1.1. What this system *is*

This project is:

> A **cloud‑native LogLine LLM World** where you can:
>
> * Define **workflows/graphs** that orchestrate LLM agents and tools
> * Define **apps** (bundles of workflows + UI) that run on top of this OS
> * Get **full traceability** of every action (tools, LLM calls, decisions)

You're not just building "a chatbot". You're building:

* an **execution engine** (Workflows + Runs + Steps + Events)
* a **capabilities layer** (Tools + Agents)
* an **app platform** (Apps + Actions + Views)

### 1.2. Why it exists

* So you can ship **multiple products/apps** on top of one shared "brain".
* So you can **observe and control** what agents do (critical for business, money, safety).
* So adding a new app is mostly **configuration** (manifest), not new bespoke code.

### 1.3. Vercel-First Architecture

This blueprint is optimized for **Vercel deployment**:

* **Serverless Functions**: All API endpoints run as serverless functions
* **Vercel Postgres**: Native Postgres with pgvector support for RAG
* **Edge-Ready**: Designed for low latency and global distribution
* **AI SDK v5**: Unified LLM interface with streaming support
* **Natural Language DB**: Read/write database operations via natural language

---

## 2. Core Concepts (Glossary)

These are the names you'll see everywhere.

* **Workflow** – A graph of nodes and edges. Describes *how* a task should be executed.
* **Run** – A single execution of a workflow with input, mode, user, etc.
* **Step** – Execution of a single node inside a run.
* **Event** – Append-only log entry: "run started", "tool called", "LLM responded", etc.
* **Tool** – A typed capability (function) the system can invoke (APIs, DB, etc.).
* **Agent** – An LLM-backed decision-maker that may call tools.
* **App** – A product built on top: a set of workflows, actions, and UI.
* **Action** – An entrypoint inside an app; calls a workflow with mapped inputs.
* **View / Widget** – Declarative description of app UI (chat, table, trace…).
* **Policy** – Rules that decide what is allowed (tools, modes, users).
* **Memory** – Persisted context (profile, long-term, short-term) with RAG support.

---

## 3. Architecture Overview

### 3.1. Three Planes

Think in three "planes":

1. **Execution Plane** – runs workflows/agents
2. **Control Plane** – manages configuration & metadata
3. **Experience Plane** – UI, apps, and developer ergonomics

All running as **serverless functions on Vercel**, backed by **Vercel Postgres** (+ optional Redis for caching) and calling out to **LLM providers via AI SDK v5**.

### 3.2. Execution Plane

Responsible for *actually doing work*.

* **Orchestrator Service**
  * Executes **Workflows/Graphs** (nodes, edges, conditions).
  * Knows about node types: `agent_node`, `tool_node`, `router`, `human_gate`, `static`.
  * Stateless; uses DB for runs, steps, events, and checkpoints.
  * Runs as serverless function (can be background job for long workflows).

* **LLM Router** (via AI SDK v5)
  * Single point to call LLM providers (OpenAI, Anthropic, Google, Mistral).
  * Handles:
    * model selection,
    * rate limits (built into AI SDK),
    * retries (automatic),
    * logging of prompts/outputs (with privacy rules).
  * Uses [Vercel AI SDK v5](https://v5.ai-sdk.dev/) for unified interface.

* **Agent Runtime**
  * Builds prompts from agent config, context, tools.
  * Calls LLM Router via AI SDK.
  * Handles tool calling loops automatically (AI SDK feature).
  * Streaming support for real-time responses.

* **Tool Runtime**
  * Registry + execution for **tools** (internal APIs, DB queries, 3rd party systems).
  * Enforces app/tool scopes and policy checks before side effects.
  * Includes natural language DB read/write tools.

* **Memory Engine** (Phase 4)
  * RAG-enabled memory storage using pgvector.
  * Semantic search for context retrieval.
  * Tools for agents to store/retrieve memories.

### 3.3. Control Plane

Defines **what exists and what's allowed**.

* **Config API / Control API**
  * CRUD for: Apps, Workflows, Tools, Agents, Policies.
  * Consumed by Studio UI and CI/CD for config.

* **Registry / Metadata Store** (DB + cache)
  * Tables for: tools, agents, workflows, apps, view manifests, policies, memory config.

* **Policy Engine**
  * Evaluates rules for:
    * tool calls,
    * workflow selection,
    * mode restrictions (draft vs auto).
  * Central gate for **tool calls** and risky actions.

* **Identity & Tenancy**
  * Integration with auth (JWT/OAuth/OIDC).
  * Every request tagged with: `user_id`, `tenant_id`, `app_id`, `role`.
  * Used by policies and data partitioning.

### 3.4. Experience Plane

What humans see and use.

* **App Shell (Front-end)**
  * Single-page app with:
    * App switcher
    * View renderer (chat, dashboards, tables, traces)
    * Settings & profile
  * Talks to: App Runtime API (`/apps/...`), Run/Trace API (`/runs/...`).

* **App Runtime API**
  * Endpoints like:
    * `POST /apps/:app_id/actions/:action_id`
    * `GET /apps/:app_id/views`
  * Resolves action → workflow → run, then streams updates.

* **Studio / Admin UI**
  * For builders: manage tools, agents, workflows, apps, policies.
  * For admins: see policy hits, errors, metrics.

### 3.5. High-level Flow

1. Front-end calls `/apps/:app_id/actions/:action_id`.
2. App runtime resolves which **workflow** to run and builds input.
3. Orchestrator starts a **run**.
4. For each node in the workflow:
   * creates a **step**
   * calls a handler (static / tool / agent)
   * logs **events**.
5. When finished, writes result, marks run completed.
6. Front-end shows result + trace.

---

## 4. Data Model & Schema

Below is the schema optimized for Vercel Postgres with pgvector support.

### 4.1. Core Execution Tables

```sql
-- Workflows: definitions of graphs
CREATE TABLE workflows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  version      TEXT NOT NULL DEFAULT '1.0.0',
  definition   JSONB NOT NULL,
  type         TEXT NOT NULL DEFAULT 'linear', -- linear|graph|subgraph
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Runs: each execution of a workflow
CREATE TABLE runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID NOT NULL REFERENCES workflows(id),
  workflow_version TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|running|paused|completed|failed|cancelled
  mode         TEXT NOT NULL DEFAULT 'draft', -- draft|auto
  input        JSONB NOT NULL,
  result       JSONB,
  app_id       UUID, -- nullable, links to apps.id
  app_action_id TEXT, -- nullable
  user_id      UUID,
  tenant_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Steps: node execution
CREATE TABLE steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES runs(id),
  node_id      TEXT NOT NULL,
  type         TEXT NOT NULL, -- static|tool|agent|router|human_gate
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|skipped
  input        JSONB,
  output       JSONB,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

-- Events: append-only trace
CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES runs(id),
  step_id      UUID REFERENCES steps(id),
  kind         TEXT NOT NULL, -- run_started|run_completed|step_started|tool_call|llm_call|policy_eval|error
  payload      JSONB NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_run ON events(run_id, ts);
CREATE INDEX idx_runs_workflow ON runs(workflow_id);
CREATE INDEX idx_steps_run ON steps(run_id);
```

### 4.2. Tools & Agents

```sql
CREATE TABLE tools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  input_schema  JSONB NOT NULL,
  output_schema JSONB NOT NULL,
  handler_ref   TEXT NOT NULL,
  risk_level    TEXT NOT NULL DEFAULT 'low', -- low|medium|high
  side_effects  TEXT[] NOT NULL DEFAULT '{}', -- ['writes_db', 'sends_email', ...]
  owner         TEXT,
  version       TEXT NOT NULL DEFAULT '1.0.0',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  instructions   TEXT NOT NULL,
  model_profile  JSONB NOT NULL, -- {provider: 'openai', model: 'gpt-4o', temperature: 0.7, max_tokens: 2000}
  allowed_tools  TEXT[] NOT NULL, -- array of tool IDs
  default_policies TEXT[] NOT NULL DEFAULT '{}', -- array of policy IDs
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3. Apps & Actions

```sql
CREATE TABLE apps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT,
  description TEXT,
  owner       TEXT,
  visibility  TEXT NOT NULL DEFAULT 'private', -- private|org|public
  default_view_id UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_scopes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      UUID NOT NULL REFERENCES apps(id),
  scope_type  TEXT NOT NULL, -- tool|memory|external
  scope_value TEXT NOT NULL
);

CREATE TABLE app_workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        UUID NOT NULL REFERENCES apps(id),
  alias         TEXT NOT NULL, -- app-local ID, e.g. "chat_support"
  workflow_id   UUID NOT NULL REFERENCES workflows(id),
  label         TEXT NOT NULL,
  default_mode  TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE app_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES apps(id),
  action_id       TEXT NOT NULL, -- stable string, e.g. "start_chat"
  label           TEXT NOT NULL,
  app_workflow_id UUID NOT NULL REFERENCES app_workflows(id),
  input_mapping   JSONB NOT NULL -- mapping from event/context -> workflow input
);
```

### 4.4. Policies (Phase 4)

```sql
CREATE TABLE policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  scope       TEXT NOT NULL, -- global|tenant|app|tool|workflow|agent
  rule_expr   JSONB NOT NULL, -- DSL/JSON for engine to evaluate
  effect      TEXT NOT NULL, -- allow|deny|require_approval|modify
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.5. Memory Items (Phase 4 - with pgvector)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type   TEXT NOT NULL, -- user|tenant|app|agent|run
  owner_id     UUID NOT NULL,
  type         TEXT NOT NULL, -- short_term|long_term|profile
  content      TEXT NOT NULL,
  metadata     JSONB,
  embedding    vector(1536), -- OpenAI embedding dimension
  visibility   TEXT NOT NULL DEFAULT 'private',
  ttl          TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_owner ON memory_items(owner_type, owner_id);
CREATE INDEX idx_memory_embedding ON memory_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Resources for RAG (chunked content)
CREATE TABLE resources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  content      TEXT NOT NULL,
  metadata     JSONB,
  embedding    vector(1536),
  memory_item_id UUID REFERENCES memory_items(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resources_embedding ON resources USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 5. Workflow Definition Spec

Workflows are stored as JSON in `workflows.definition`.

### 5.1. Minimal spec (v1)

```ts
type NodeType = 'static' | 'tool_node' | 'agent_node' | 'router' | 'human_gate';

interface WorkflowNode {
  id: string;
  type: NodeType;
  config?: {
    tool_id?: string;
    agent_id?: string;
    condition?: string; // for router nodes
  };
}

interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string; // optional edge condition
}

interface WorkflowDefinition {
  entry: string;              // node id
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
```

**Rules:**

* `entry` must match a node id.
* Graph must not have infinite cycles without some guard.
* Node types:
  * `static`: simple deterministic code (no tools/agents).
  * `tool_node`: calls a single Tool.
  * `agent_node`: calls an Agent (which may internally use tools).
  * `router`: conditional routing based on step output.
  * `human_gate`: pause for human approval (future).

### 5.2. Example: simple linear workflow

```jsonc
{
  "entry": "start",
  "nodes": [
    { "id": "start", "type": "static" },
    { "id": "process", "type": "static" },
    { "id": "finish", "type": "static" }
  ],
  "edges": [
    { "from": "start", "to": "process" },
    { "from": "process", "to": "finish" }
  ]
}
```

### 5.3. Example: workflow with Tool + Agent

```jsonc
{
  "entry": "start",
  "nodes": [
    { "id": "start", "type": "static" },
    {
      "id": "fetch_tickets",
      "type": "tool_node",
      "config": { "tool_id": "tool.ticketing.list_open" }
    },
    {
      "id": "triage",
      "type": "agent_node",
      "config": { "agent_id": "agent.ticket_triage" }
    }
  ],
  "edges": [
    { "from": "start", "to": "fetch_tickets" },
    { "from": "fetch_tickets", "to": "triage" }
  ]
}
```

---

## 6. Tools & Agents Design

### 6.1. Tool Runtime

#### Handler Registry (code)

```ts
// backend/src/tools/registry.ts
export type ToolHandler = (input: any, ctx: ToolContext) => Promise<any>;

interface ToolContext {
  runId: string;
  stepId: string;
  appId?: string;
  userId?: string;
  tenantId: string;
}

const registry: Record<string, ToolHandler> = {
  'ticketing.list_open': async (input, ctx) => {
    // TODO: real integration later
    return {
      tickets: [
        { id: 'T-1', subject: 'No hot water', status: 'open' },
        { id: 'T-2', subject: 'Late check-in', status: 'open' }
      ]
    };
  },
  'natural_language_db_read': async (input, ctx) => {
    // Natural language SQL read tool
    // See PHASE2_AI_SDK_INTEGRATION.md
  },
  'natural_language_db_write': async (input, ctx) => {
    // Natural language SQL write tool (with policy checks)
    // See PHASE2_AI_SDK_INTEGRATION.md
  }
};

export async function callTool(
  toolId: string,
  input: any,
  ctx: ToolContext
) {
  const handler = registry[toolId];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolId}`);
  }

  // Policy check before execution
  const allowed = await policyEngine.checkToolCall(toolId, ctx);
  if (!allowed) {
    throw new Error(`Policy denied: Tool ${toolId} not allowed`);
  }

  // Input validation using tool.input_schema
  const validated = await validateInput(input, tool.input_schema);

  const output = await handler(validated, ctx);

  // Log event
  await db.events.insert({
    run_id: ctx.runId,
    step_id: ctx.stepId,
    kind: 'tool_call',
    payload: { tool_id: toolId, input: validated, output },
    ts: new Date()
  });

  return output;
}
```

### 6.2. Agent Runtime (via AI SDK v5)

#### Agent Config Example

```sql
INSERT INTO agents (id, name, instructions, model_profile, allowed_tools)
VALUES (
  'agent.ticket_triage',
  'Ticket triage agent',
  'You are a support triage agent. Decide priority and suggested action for each ticket.',
  '{"provider": "openai", "model": "gpt-4o", "temperature": 0.7}'::jsonb,
  ARRAY['tool.ticketing.list_open', 'natural_language_db_read']
);
```

#### Runtime (using AI SDK v5)

```ts
// backend/src/agents/runtime.ts
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function runAgentStep(
  agentId: string,
  input: any,
  ctx: { runId: string; stepId: string; tools: Tool[] }
) {
  const agent = await db.agents.findById(agentId);
  
  // Convert tools to AI SDK format
  const aiTools = ctx.tools.map(t => 
    tool({
      description: t.description,
      parameters: z.object(t.input_schema),
      execute: async (params) => {
        return await callTool(t.id, params, ctx);
      },
    })
  );

  // Build prompt from agent config
  const prompt = buildAgentPrompt(agent, input, ctx);

  // Generate with tool calling (AI SDK handles the loop)
  const result = await generateText({
    model: getModel(agent.model_profile), // AI SDK model
    prompt,
    tools: aiTools,
    maxSteps: 5, // Allow multi-turn tool calling
  });

  // Log agent call and tool calls
  await db.events.insert({
    run_id: ctx.runId,
    step_id: ctx.stepId,
    kind: 'llm_call',
    payload: { 
      agent_id: agentId, 
      prompt,
      response: result.text,
      tool_calls: result.toolCalls 
    },
    ts: new Date()
  });

  return {
    agent_id: agentId,
    text: result.text,
    tool_calls: result.toolCalls,
    finish_reason: result.finishReason
  };
}
```

**Key Features:**
- Automatic tool calling loop (AI SDK handles this)
- Multi-step reasoning
- Streaming support available
- Unified provider interface

---

## 7. App Platform & Manifest Spec

An **App** is declared via a manifest. Backend imports it into DB.

### 7.1. Minimal manifest v1

```jsonc
{
  "version": "1.0.0",
  "app": {
    "id": "guest_support_console",
    "name": "Guest Support Console",
    "icon": "🛎️",
    "description": "Triage and resolve guest issues.",
    "owner": "org:voulezvous",
    "visibility": "org",

    "scopes": {
      "tools": [
        "tool.ticketing.list_open",
        "natural_language_db_read"
      ],
      "memory": [],
      "external": []
    },

    "workflows": [
      {
        "id": "ticket_flow",
        "workflow_ref": "demo_tickets_v1",
        "label": "Ticket triage flow",
        "default_mode": "draft"
      }
    ],

    "actions": [
      {
        "id": "triage_ticket",
        "label": "Triage ticket",
        "workflow_id": "ticket_flow",
        "input_mapping": {
          "hotel_id": "$context.hotel_id"
        }
      }
    ]
  }
}
```

### 7.2. Import process (backend)

`POST /apps/import`:

1. Validate manifest structure and version.
2. Upsert into `apps`.
3. Insert `app_scopes` rows (`scope_type=tool` for each `tools[]`).
4. Insert `app_workflows` rows:
   * find `workflow_ref` in `workflows.id`.
   * store alias (`id` from manifest).
5. Insert `app_actions`:
   * resolve `workflow_id` by alias → `app_workflow_id`.
   * store `input_mapping` JSON.

---

## 8. HTTP API Reference (MVP)

### Health

* `GET /healthz`
  → `{ status: "ok" }`

### Workflows

* `POST /workflows`
  **Body:**
  ```json
  {
    "name": "Demo Tickets Flow",
    "version": "1.0.0",
    "definition": { ... } // WorkflowDefinition JSON
  }
  ```

* `GET /workflows`
  → List workflows (with pagination: `?page=1&limit=10`)

* `GET /workflows/:id`
  → full workflow JSON.

* `PATCH /workflows/:id`
  → Update workflow

* `DELETE /workflows/:id`
  → Delete workflow

### Runs

* `POST /workflows/:id/runs`
  **Body:**
  ```json
  {
    "input": {
      "hotel_id": "VV-LISBON"
    },
    "mode": "draft"
  }
  ```
  → Creates run, executes workflow, returns:
  ```json
  {
    "id": "uuid",
    "status": "completed",
    "result": { ... }
  }
  ```

* `GET /runs/:id`
  → run row: workflow, status, input, result.

* `GET /runs/:id/events`
  → array of events sorted by timestamp.

* `GET /runs/:id/stream` (Phase 2)
  → Server-Sent Events stream of run progress

### Tools

* `GET /tools`
  → list of registered tools.

* `POST /tools`
  → create/update tool (used in internal tooling / Studio).

### Agents

* `GET /agents`
  → list agents.

* `POST /agents`
  → create/update.

* `POST /agents/:id/test`
  **Body:**
  ```json
  { "input": { "hotel_id": "VV-LISBON" } }
  ```
  → result of `runAgentStep`.

### Apps

* `POST /apps/import`
  → imports manifest.

* `GET /apps`
  → list apps.

* `POST /apps/:app_id/actions/:action_id`
  **Body (from UI):**
  ```json
  {
    "event": {
      "hotel_id": "VV-LISBON"
    },
    "context": {
      "user_id": "user:dan",
      "tenant_id": "tenant:voulezvous",
      "hotel_id": "VV-LISBON"
    }
  }
  ```
  Backend:
  * resolves app_action → app_workflow → workflow_id
  * builds workflow input via `input_mapping`
  * creates run (with app_id, app_action_id, user_id, tenant_id)
  * executes
  * returns `{ run_id, status, result }`.

---

## 9. Deployment & Environments (Vercel)

### 9.1. Vercel Setup

**Recommended setup:**

* **Dev:** Local with Docker Compose for Postgres
* **Prod:** Vercel (Serverless) + Vercel Postgres

#### Vercel Configuration

* **Backend**: NestJS app deployed as serverless functions
* **Database**: Vercel Postgres (with pgvector extension)
* **Frontend**: Next.js (or separate frontend app)
* **Environment**: Automatic via Vercel environment variables

#### Project Structure

```
backend/
├── api/
│   └── index.ts          # Vercel serverless handler
├── src/                  # NestJS application
├── vercel.json          # Vercel configuration
└── package.json
```

### 9.2. Environment Variables

**Required:**
* `POSTGRES_URL` - Automatically set by Vercel Postgres
* `OPENAI_API_KEY` - For LLM calls (or other provider keys)
* `NODE_ENV` - Set automatically by Vercel

**Optional:**
* `ANTHROPIC_API_KEY` - For Claude models
* `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models
* `LOG_LEVEL` - Logging level (default: info)

### 9.3. Database Setup

1. **Create Vercel Postgres Database**
   * Vercel Dashboard → Storage → Create Database → Postgres
   * `POSTGRES_URL` is automatically set

2. **Enable pgvector Extension**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Run Migrations**
   * Use TypeORM migrations or manual SQL
   * Schema auto-syncs in dev (disabled in production)

### 9.4. Deployment Steps

1. **Connect Repository to Vercel**
   * Push code to GitHub/GitLab/Bitbucket
   * Import repository in Vercel dashboard
   * Set root directory to `backend`

2. **Configure Environment Variables**
   * Add `OPENAI_API_KEY` and other provider keys
   * `POSTGRES_URL` is automatically available

3. **Deploy**
   * Automatic on push to main branch
   * Or use `vercel --prod` CLI command

### 9.5. Serverless Considerations

* **Cold Starts**: First request after inactivity may be slower (~1-2 seconds)
* **Function Timeout**: Default 10 seconds (60s on Pro plan)
* **Long Workflows**: Consider background jobs or breaking into smaller steps
* **Connection Pooling**: Vercel Postgres handles this automatically
* **Streaming**: Use Server-Sent Events for real-time updates

See [VERCEL_DEPLOYMENT.md](./backend/VERCEL_DEPLOYMENT.md) for detailed deployment guide.

---

## 10. Observability, Testing & Maintenance

### 10.1. Observability

* **Logging:**
  * Every `tool_call` and `llm_call` logged as events.
  * Structured logs to stdout with `run_id`, `step_id`.
  * Vercel automatically captures logs in dashboard.

* **Tracing:**
  * Full trace available via `GET /runs/:id/events`.
  * Events include: run_started, step_started, tool_call, llm_call, policy_eval, error, run_completed.

* **Metrics:**
  * Add `/metrics` endpoint later if using Prometheus.
  * Vercel Analytics for request metrics.

### 10.2. Testing Strategy

* **Unit tests:**
  * Orchestrator: given a workflow definition + input, verify sequence of nodes and events.
  * `callTool`: correct event payload, handles missing tool, policy checks.
  * `runAgentStep`: uses allowed_tools correctly, AI SDK integration.

* **Integration tests:**
  * Boot DB, seed one workflow, tool, agent.
  * Call `POST /workflows/:id/runs`.
  * Assert: run status, steps count, events sequence.

* **E2E tests:**
  * Full workflow execution with real LLM calls (use test API keys).
  * Verify tool calling, memory storage, RAG retrieval.

* **Contract tests:**
  * For tools with external systems, define schemas and check responses.

### 10.3. Maintenance

* **Migrations:** Use TypeORM migrations; never edit schema directly in prod.
* **Versioning:**
  * `workflows.version` for changes
  * Keep old versions for existing runs
* **Backups:**
  * Vercel Postgres automatic backups
  * Export logs to S3/equivalent if needed

---

## 11. Implementation Roadmap

### Phase 1 – Platform Foundation (✅ COMPLETE)

**Goal:** Have a reliable execution ledger running in the cloud.

1. ✅ Infra:
   * Vercel deployment setup
   * Vercel Postgres database
   * Serverless function configuration

2. ✅ Core tables:
   * `workflows`, `runs`, `steps`, `events`

3. ✅ Orchestrator v0:
   * Can run a linear workflow (hard-coded or simple JSON)
   * Writes steps & events

4. ✅ Basic APIs:
   * `POST /workflows/:id/runs`
   * `GET /runs/:id`
   * `GET /runs/:id/events`

**Done when:**
You can deploy to Vercel, hit a public endpoint to start a run, and see its trace via API.

### Phase 2 – Agents, Tools & LLM Integration

**Goal:** Runs now use **real tools** and **agents** powered by an LLM.

1. Add tables:
   * `tools`, `agents`

2. Implement:
   * Tool runtime (`callTool`) with policy checks
   * Agent runtime (`runAgentStep`) using AI SDK v5
   * LLM Router (wraps AI SDK v5 for unified provider interface)

3. Natural Language Database Tools:
   * Read tool (SELECT queries only)
   * Write tool (INSERT/UPDATE with confirmation and policy checks)

4. Orchestrator:
   * Support node types: `tool_node`, `agent_node`
   * Trace includes: `tool_call`, `llm_call` events

5. Simple policies:
   * Hard-coded rules or minimal `policies` table
   * Deny certain tool calls based on context

**Done when:**
A deployed workflow can call an LLM-backed agent, which calls a tool (including natural language DB operations), and you see everything in the trace.

**See:** [PHASE2_AI_SDK_INTEGRATION.md](./PHASE2_AI_SDK_INTEGRATION.md)

### Phase 3 – App Layer & Developer Surface

**Goal:** Turn the engine into a **platform where you define Apps** with manifests and UI.

1. Add tables:
   * `apps`, `app_scopes`, `app_workflows`, `app_actions`
   * optionally `app_views`, `app_widgets` (for UI binding)

2. Implement:
   * App manifest format (JSON/YAML)
   * `POST /apps/import` to load/validate manifests
   * App Runtime API: `POST /apps/:app_id/actions/:action_id`

3. Link runs to apps:
   * `runs` gets `app_id`, `app_action_id`

4. Enforce scopes:
   * Tool runtime checks app/tool scopes before executing (`app_scopes`)

5. Front-end shell:
   * App list/switcher
   * Simple view: app page with:
     * Chat panel bound to an app action
     * Trace viewer for runs of that app

**Done when:**
You can define an app as a manifest, import it, open it in the UI, trigger actions, and watch its runs & traces — without changing core code.

### Phase 4 – Memory, Governance, and UX Polish

**Goal:** Make it **LLM‑first AND enterprise‑safe**.

1. Memory (RAG-enabled):
   * `memory_items` table with pgvector embeddings
   * `resources` table for chunked content
   * Memory tools for: store / retrieve / search
   * Integrate into workflows for RAG flows

2. Policy Engine v1:
   * `policies` table
   * Small rule language or config
   * Used for tool calls, modes, maybe data access

3. Modes:
   * `draft | auto` per run/action/app
   * Front-end toggle for mode
   * Policies use mode to restrict side effects

4. Studio:
   * UI to:
     * list runs, inspect traces
     * manage tools, agents, workflows, apps
     * see policy hits, errors

5. Hardening:
   * Auth & RBAC
   * Audit logging
   * Alerts/metrics dashboards (per app & per workflow)

**Done when:**
You can onboard a new app, constrain what it can touch (tools/memory), have different modes (draft/auto), and feel safe letting it operate for real data.

**See:** [PHASE4_RAG_MEMORY_INTEGRATION.md](./PHASE4_RAG_MEMORY_INTEGRATION.md)

---

## 12. How to Extend the Platform Safely

### To add a new Tool

1. Write handler function in registry.
2. Add `tools` row with schemas and `handler_ref`.
3. Use it in:
   * a new workflow node (`type: "tool_node"`),
   * or add to an agent's `allowed_tools`.
4. If exposed via apps:
   * include tool in `app.scopes.tools`.

### To add a new Agent

1. Add `agents` row with instructions, model_profile (using AI SDK provider), allowed_tools.
2. Add `agent_node` in a workflow with `config.agent_id`.
3. Test via `POST /agents/:id/test`.
4. Deploy.

### To add a new App

1. Write `app_manifest.json` (as shown).
2. `POST /apps/import`.
3. Wire UI to call `POST /apps/:id/actions/:action_id`.

### To add RAG capabilities

1. Store content as `resources` (chunked and embedded).
2. Use `queryKnowledgeBaseTool` in agent's `allowed_tools`.
3. Agent automatically retrieves relevant context via semantic search.

---

## References & Documentation

### Implementation Guides

- [PHASE2_AI_SDK_INTEGRATION.md](./PHASE2_AI_SDK_INTEGRATION.md) - AI SDK v5 integration
- [PHASE4_RAG_MEMORY_INTEGRATION.md](./PHASE4_RAG_MEMORY_INTEGRATION.md) - RAG Memory Engine
- [backend/VERCEL_DEPLOYMENT.md](./backend/VERCEL_DEPLOYMENT.md) - Vercel deployment guide
- [backend/AI_SDK_QUICK_START.md](./backend/AI_SDK_QUICK_START.md) - AI SDK quick reference

### External Resources

- [Vercel AI SDK v5 Documentation](https://v5.ai-sdk.dev/)
- [AI SDK RAG Agent Guide](https://ai-sdk.dev/llms.txt)
- [Natural Language Postgres Template](https://vercel.com/templates/next.js/natural-language-postgres)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

---

**End of Master Blueprint**

