# LogLine LLM World - Master Blueprint

> A **cloud‑native LLM-first Agent OS** + **App platform** built for **Hybrid Deployment** (Vercel + Railway).

**Version:** 2.6
**Last Updated:** 2024-11-21
**Deployment Targets:** 
* **Brain:** Vercel (Serverless) + Vercel Postgres
* **Muscle:** Railway (Containerized Executor)

**Recent Updates:**
* ✅ **Phase 6 COMPLETE**: LogLine Executor (Sidecar/Muscle) implemented on Railway for heavy tools (Puppeteer, Code Execution).
* ✅ **Phase 5 COMPLETE**: Registry Universal fully implemented (People, Agents, Contracts, Ideas, Objects, Apps).
* ✅ **Financial Refactoring**: All monetary values standardized to **Integer Cents** to eliminate floating-point errors.
* ✅ **Auth-Registry Bridge**: Users are now linked to Universal Identities (LogLine ID) upon registration.
* ✅ **Agent Observability**: Full execution logging (inputs, outputs, costs, tools) for every agent run.
* ✅ **Phase 4 Critical Fixes COMPLETE**: Policy Engine v1 fully integrated into ToolRuntimeService and AgentRuntimeService
* ✅ **Tools Governance**: Added `risk_level` (low/medium/high) and `side_effects` columns to tools table
* ✅ **Policy Enforcement**: All tool calls and agent calls now pass through Policy Engine v1 before execution
* ✅ **Memory Security**: Added tenant/user/app ownership validation to Memory tools (prevents data exfiltration)

**LLM-First Design**: This blueprint emphasizes LLM-first design where agents (LLM-powered) make routing, conditional, and tool selection decisions. See [LLM-First Design Review](./docs/design/LLM_FIRST_DESIGN_REVIEW.md) for compliance review.

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
9. [Deployment & Environments](#9-deployment--environments)
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

### 1.3. LLM-First Design Principle

**Core Principle**: LLMs are the primary decision-makers in the system.

* **Agents Make Decisions**: Routing, conditionals, and tool selection are LLM-powered
* **Natural Language First**: Natural language is a first-class interface for configuration and interaction
* **Intelligent Orchestration**: Complex decisions use agents, not hardcoded rules
* **Tool Selection by Agents**: Tools are primarily invoked by agents via LLM reasoning, not directly by workflows
* **Structured Context**: JSON✯Atomic format provides structured, self-describing data for better LLM understanding
* **Natural Language Structuring**: TDLN-T pre-processes natural language into JSON✯Atomic format before LLM consumption

**Why LLM-First?**
* Enables natural language workflow definition
* Makes routing decisions explainable and adaptable
* Allows dynamic tool discovery and selection
* Supports complex, context-aware decision-making
* Reduces hallucinations through structured context (JSON✯Atomic)
* Improves understanding through natural language structuring (TDLN-T)

### 1.4. Hybrid Architecture (Brain + Muscle)

This blueprint is optimized for a **Hybrid Deployment**:

* **Brain (Vercel)**: Serverless, stateless, high-concurrency. Handles logic, orchestration, DB, and API.
* **Muscle (Railway)**: Containerized, stateful, heavy-duty. Handles code execution, browser automation, and long-running tasks.

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
* **Registry** – Universal repository for People, Objects, Ideas, Contracts, and Apps.
* **Executor** – Remote service for executing heavy/risky tools (Code, Browser).

---

## 3. Architecture Overview

### 3.1. Four Planes

Think in four "planes":

1. **Execution Plane** – runs workflows/agents (Brain + Muscle)
2. **Control Plane** – manages configuration & metadata
3. **Experience Plane** – UI, apps, and developer ergonomics
4. **Registry Plane** – Universal identity and asset management

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
  * **Policy Engine v1 integration**: All agent calls pass through `PolicyEngineV1Service.checkAgentCall()` before execution.
  * Calls LLM Router via AI SDK.
  * Handles tool calling loops automatically (AI SDK feature).
  * Streaming support for real-time responses.
  * Integrates JSON✯Atomic format for structured context.
  * Pre-processes natural language with TDLN-T (refract to JSON✯Atomic).
  * Combines natural language summaries with structured atomic data.

* **Tool Runtime**
  * Registry + execution for **tools** (internal APIs, DB queries, 3rd party systems).
  * Enforces app/tool scopes and policy checks before side effects.
  * **Hybrid Execution**:
    * `builtin` tools run locally on Vercel.
    * `remote` tools are proxied to the **Executor** service.

* **Executor Service (The Muscle)**
  * Runs on **Railway** (Docker).
  * Handles "heavy" tools:
    * `code_interpreter` (Python/JS sandbox).
    * `web_browser` (Puppeteer/Playwright).
    * `file_system` (Persistent storage operations).
  * Secured via HMAC-SHA256 signature.

* **Context Services**
  * **Context Summarizer**: Converts structured data to natural language summaries.
  * **Atomic Event Converter**: Converts events/steps/runs to JSON✯Atomic format.
  * **TDLN-T Service**: Structures natural language into JSON✯Atomic (primary use) and deterministic translation (secondary use).

* **Memory Engine** (Phase 4)
  * RAG-enabled memory storage using pgvector.
  * Semantic search for context retrieval.
  * Tools for agents to store/retrieve memories.

### 3.6. Golden Run (Canon)

The Golden Run is the minimal, complete execution example in LogLine LLM World.  
It defines the contract that all future features must respect.

**Golden Run: "Ticket Triage Demo"**

- Workflow: `demo_ticket_triage_v1`
- Nodes:
  - `start` (static)
  - `fetch_tickets` (tool_node → `ticketing.list_open`)
  - `triage` (agent_node → `agent.ticket_triage`)
- HTTP Call:

```http
POST /workflows/{workflow_id}/runs
Content-Type: application/json

{
  "input": { "hotel_id": "VV-LISBON" },
  "mode": "draft"
}
```

**Expected Result (form):**

```json
{
  "id": "RUN_ID",
  "status": "completed",
  "result": {
    "summary": "N tickets triaged",
    "tickets": [
      {
        "id": "T-1",
        "subject": "No hot water in room 305",
        "status": "open",
        "priority": "urgent",
        "action": "escalate_to_human"
      }
    ]
  }
}
```

**Minimum Events:**

```json
[
  { "kind": "run_started", "run_id": "RUN_ID", "ts": "..." },
  { "kind": "step_started", "step_id": "STEP_START", "node_id": "start" },
  { "kind": "step_started", "step_id": "STEP_TOOL", "node_id": "fetch_tickets" },
  { "kind": "tool_call", "payload": { "tool_id": "ticketing.list_open" } },
  { "kind": "step_started", "step_id": "STEP_AGENT", "node_id": "triage" },
  { "kind": "llm_call", "payload": { "agent_id": "agent.ticket_triage" } },
  { "kind": "run_completed", "run_id": "RUN_ID", "ts": "..." }
]
```

**Contract:** Any new feature that breaks this story is wrong.

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
  * Every request tagged with: `user_id`, `tenant_id`, `app_id`, `role`, `logline_id`.
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
  cost_limit_cents   INTEGER, -- optional execution budget
  llm_calls_limit    INTEGER, -- optional execution budget
  latency_slo_ms     INTEGER, -- optional execution budget
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

#### 4.1.1. Execution Budgets per Run

Each `run` can optionally carry an "execution budget":

- `cost_limit_cents` – cost ceiling in cents for LLM + charged tools.
- `llm_calls_limit` – maximum number of LLM calls allowed during the run.
- `latency_slo_ms` – target latency SLO (for user hot path).

The orchestrator must:

- Terminate the run with a controlled error if the budget is exceeded.
- Register a `policy_eval` or `error` event with the reason:
  - `budget_exceeded: cost`
  - `budget_exceeded: llm_calls`
  - `budget_exceeded: latency`

This transforms healthy paranoia into something computable and LogLine-core.
```

### 4.2. Tools & Agents

```sql
CREATE TABLE tools (
  id            VARCHAR(255) PRIMARY KEY, -- e.g., 'natural_language_db_read', 'ticketing.list_open'
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  input_schema  JSONB NOT NULL, -- JSON Schema for tool inputs
  handler_type  VARCHAR(50), -- 'code', 'http', 'builtin', 'remote'
  handler_config JSONB, -- Handler-specific config
  risk_level    VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  side_effects  TEXT[] NOT NULL DEFAULT '{}', -- ['database_read', 'database_write', 'memory_storage', ...]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tools_risk_level ON tools(risk_level);

CREATE TABLE agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  instructions   TEXT NOT NULL,
  model_profile  JSONB NOT NULL, -- {provider: 'openai', model: 'gpt-4o', temperature: 0.7, max_tokens: 2000}
  allowed_tools  TEXT[] NOT NULL, -- array of tool IDs
  default_policies TEXT[] NOT NULL DEFAULT '{}', -- array of policy IDs
  
  -- Registry / Identity Fields
  logline_id     VARCHAR(50), -- Universal ID with checksum
  active_contract_id UUID,
  avg_cost_per_run_cents INTEGER,
  
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

### 4.4. Registry Universal (Phase 5 - COMPLETE)

```sql
-- Core People
CREATE TABLE core_people (
  logline_id    VARCHAR(50) PRIMARY KEY, -- LL-BR-2024-XXXXX-SUM
  cpf_hash      VARCHAR(64) UNIQUE,
  name          VARCHAR(255) NOT NULL,
  email_primary VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Registry Objects (now includes services)
CREATE TABLE registry_objects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type     TEXT NOT NULL CHECK (object_type IN ('document', 'file', 'merchandise', 'collection', 'lost_found', 'inventory', 'service')),
  name            TEXT NOT NULL,
  tenant_id       UUID,
  owner_logline_id VARCHAR(50),
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Registry Contracts
CREATE TABLE registry_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          TEXT NOT NULL,
  estado_atual    TEXT NOT NULL DEFAULT 'RASCUNHO',
  valor_total_cents INTEGER,
  penalidade_aplicada_cents INTEGER,
  autor_logline_id VARCHAR(50),
  contraparte_logline_id VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Registry Apps (Marketplace)
CREATE TABLE registry_apps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       TEXT NOT NULL, -- '@owner/app-id'
  version         TEXT NOT NULL, -- '1.0.0'
  app_id          VARCHAR(255) NOT NULL, -- ID do app original
  manifest        JSONB NOT NULL, -- Manifest completo
  owner_id        UUID NOT NULL, -- User/org que publicou
  tenant_id       UUID, -- Tenant de origem (opcional)
  visibility      TEXT NOT NULL DEFAULT 'public', -- 'public' | 'org'
  downloads       INTEGER NOT NULL DEFAULT 0,
  rating          DECIMAL(3,2), -- 0.00 a 5.00
  rating_count    INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  readme          TEXT, -- Markdown README
  tags            TEXT[], -- ['support', 'triage', 'automation']
  dependencies    JSONB, -- [{namespace: '@logline/core-tools', version: '^1.0.0'}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  UNIQUE(namespace, version)
);
```

### 4.5. Policies (Phase 4)

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

#### 4.4.1. Policy Semantics (v1)

To keep the system auditable and predictable, policies in v1 have restricted semantics:

- Policies **cannot** rewrite the input or output of tools/agents.
- Policies can only:
  - `allow` – permit the operation.
  - `deny` – block the operation.
  - `require_approval` – block until external human approval.
  - `modify` – only for metadata (e.g., force `mode=draft`), never for business payload.

**Evaluation Order:**

1. **Run Start**: Before starting a workflow run, `OrchestratorService.startRun()` calls `PolicyEngineV1Service.checkRunStart()` with:
   - `subject` (user_id, tenant_id, app_id)
   - `action`: `run_start`
   - `resource` (workflow_id)
   - `context` (mode, input)

2. **Tool Call**: Before executing any tool, `ToolRuntimeService.callTool()` calls `PolicyEngineV1Service.checkToolCall()` with:
   - `subject` (user_id, tenant_id, app_id)
   - `action`: `tool_call`
   - `resource` (tool_id)
   - `context` (run_id, mode, risk_level from tool entity)

3. **Agent Call**: Before executing any agent, `AgentRuntimeService.runAgentStep()` calls `PolicyEngineV1Service.checkAgentCall()` with:
   - `subject` (user_id, tenant_id, app_id)
   - `action`: `workflow_execution`
   - `resource` (agent_id)
   - `context` (run_id, mode)

4. If any policy returns `deny` → operation aborted and `policy_eval` + `error` event logged.

5. If returns `require_approval` → the run enters `status = "paused"` with a `human_gate`. Use `PATCH /runs/:id/resume` to continue after approval.

6. `modify` can only alter control fields (mode, limits, flags), never domain data.

**Implementation Status:**
- ✅ Policy Engine v1 fully integrated into `ToolRuntimeService` (all tool calls are policy-checked)
- ✅ Policy Engine v1 fully integrated into `AgentRuntimeService` (all agent calls are policy-checked)
- ✅ Policy Engine v1 integrated into `OrchestratorService` (run starts are policy-checked)
- ✅ Tools have `risk_level` column (low/medium/high) used by policies
- ✅ All policy decisions are logged as `POLICY_EVAL` events

This eliminates ambiguity and ensures all tool/agent executions pass through governance.

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

### 4.6. Authentication & RBAC Tables (Phase 4)

```sql
-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user', -- admin|developer|user
  tenant_id     UUID,
  logline_id    VARCHAR(50), -- Link to Registry Identity
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Sessions
CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- API Keys
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  permissions  TEXT[] DEFAULT ARRAY['read', 'write'],
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### 4.7. Audit Logs Table (Phase 4)

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  action        TEXT NOT NULL, -- login|logout|create|update|delete|execute|policy_deny
  resource_type TEXT NOT NULL, -- workflow|tool|agent|app|run|policy|user
  resource_id   UUID,
  changes       JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  tenant_id     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

### 4.8. Alert Configuration Tables (Phase 4)

```sql
CREATE TABLE alert_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  tenant_id             UUID,
  rule_type             TEXT NOT NULL, -- error_rate|budget_exceeded|policy_denials|memory_usage|rate_limit
  threshold             NUMERIC NOT NULL,
  comparison_operator   TEXT NOT NULL DEFAULT '>', -- >|<|>=|<=|==
  notification_channels TEXT[] DEFAULT ARRAY['webhook'], -- webhook|email|slack|pagerduty
  enabled               BOOLEAN NOT NULL DEFAULT true,
  last_checked_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_configs_tenant ON alert_configs(tenant_id);
CREATE INDEX idx_alert_configs_enabled ON alert_configs(enabled);

CREATE TABLE alert_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_config_id UUID NOT NULL REFERENCES alert_configs(id) ON DELETE CASCADE,
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,
  message        TEXT NOT NULL,
  metadata       JSONB
);

CREATE INDEX idx_alert_history_config ON alert_history(alert_config_id);
CREATE INDEX idx_alert_history_triggered ON alert_history(triggered_at);
CREATE INDEX idx_alert_history_resolved ON alert_history(resolved_at) WHERE resolved_at IS NULL;
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
    tool_id?: string; // for tool_node
    agent_id?: string; // for agent_node
    router_agent_id?: string; // for router nodes - agent that makes routing decision
    routes?: Array<{ // for router nodes
      id: string;
      condition?: string; // natural language condition
      target_node: string;
    }>;
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
  * `tool_node`: calls a single Tool directly (use sparingly; prefer `agent_node` for LLM-first design).
  * `agent_node`: calls an Agent (which may internally use tools). **Preferred for LLM-first design.**
  * `router`: **LLM-powered** conditional routing based on step output. Uses an agent to make routing decisions.
  * `human_gate`: pause for human approval. Agent determines if human input is needed (future).

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

**Note**: In LLM-first design, prefer using `agent_node` that calls tools via LLM reasoning rather than direct `tool_node` calls. This enables dynamic tool selection and better explainability.

### 5.4. Example: workflow with LLM-powered router

```jsonc
{
  "entry": "start",
  "nodes": [
    { "id": "start", "type": "static" },
    {
      "id": "triage",
      "type": "agent_node",
      "config": { "agent_id": "agent.ticket_triage" }
    },
    {
      "id": "route_decision",
      "type": "router",
      "config": {
        "router_agent_id": "agent.router",
        "routes": [
          {
            "id": "high_priority",
            "condition": "if ticket priority is high or urgent",
            "target_node": "escalate"
          },
          {
            "id": "normal",
            "condition": "if ticket priority is normal or low",
            "target_node": "auto_resolve"
          }
        ]
      }
    },
    { "id": "escalate", "type": "agent_node", "config": { "agent_id": "agent.escalate" } },
    { "id": "auto_resolve", "type": "agent_node", "config": { "agent_id": "agent.auto_resolve" } }
  ],
  "edges": [
    { "from": "start", "to": "triage" },
    { "from": "triage", "to": "route_decision" },
    { "from": "route_decision", "to": "escalate", "condition": "high_priority" },
    { "from": "route_decision", "to": "auto_resolve", "condition": "normal" }
  ]
}
```

**LLM-Powered Routing**: The router node uses an agent (`router_agent_id`) to evaluate conditions in natural language and select the appropriate route. This ensures all routing decisions are LLM-powered and explainable.

### 5.5. Conditional Edges

Edges can have `condition` properties that are evaluated using agents:

```jsonc
{
  "edges": [
    {
      "from": "check_status",
      "to": "approve",
      "condition": "if status is approved and amount is less than 1000"
    },
    {
      "from": "check_status",
      "to": "reject",
      "condition": "if status is rejected or amount is greater than 1000"
    }
  ]
}
```

**Evaluation**: Conditions are evaluated by an agent that receives the previous step's output and determines which edge to follow. This enables natural language conditions and context-aware routing.

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

* `GET /runs/:id/stream` (Phase 1.5) - Server-Sent Events for real-time updates
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

### Authentication (Phase 4)

* `POST /api/v1/auth/register`
  **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "secure_password",
    "name": "User Name"
  }
  ```
  → Returns user and tokens

* `POST /api/v1/auth/login`
  **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "secure_password"
  }
  ```
  → Returns user and tokens

* `POST /api/v1/auth/refresh`
  **Body:**
  ```json
  {
    "refresh_token": "refresh_token_string"
  }
  ```
  → Returns new access token

* `POST /api/v1/auth/logout`
  → Invalidates session

* `GET /api/v1/auth/me` (requires JWT)
  → Returns current user

* `POST /api/v1/auth/api-keys` (requires JWT)
  **Body:**
  ```json
  {
    "name": "My API Key",
    "permissions": ["read", "write"]
  }
  ```
  → Returns API key (shown only once)

* `GET /api/v1/auth/api-keys` (requires JWT)
  → Returns list of user's API keys

* `POST /api/v1/auth/api-keys/:id/revoke` (requires JWT)
  → Revokes API key

### Audit (Phase 4)

* `GET /api/v1/audit/logs` (requires JWT, admin/developer role)
  **Query params:**
  - `user_id` - Filter by user
  - `resource_type` - Filter by resource type
  - `resource_id` - Filter by resource ID
  - `action` - Filter by action
  - `start_date` - Start date filter
  - `end_date` - End date filter
  - `page` - Pagination page
  - `limit` - Results per page
  → Returns audit logs

### Metrics (Phase 4)

* `GET /api/v1/metrics`
  **Query params:**
  - `format` - `json` (default) or `prometheus`
  → Returns metrics snapshot

### Alerts (Phase 4)

* `GET /api/v1/alerts/configs` (requires JWT)
  → Returns alert configurations

* `POST /api/v1/alerts/configs` (requires JWT, admin/developer role)
  **Body:**
  ```json
  {
    "name": "High Error Rate",
    "description": "Alert when error rate exceeds 5%",
    "rule_type": "error_rate",
    "threshold": 0.05,
    "comparison_operator": ">",
    "notification_channels": ["email", "slack"]
  }
  ```
  → Creates alert configuration

* `PATCH /api/v1/alerts/configs/:id` (requires JWT, admin/developer role)
  → Updates alert configuration

* `DELETE /api/v1/alerts/configs/:id` (requires JWT, admin/developer role)
  → Deletes alert configuration

* `POST /api/v1/alerts/check` (requires JWT, admin/developer role)
  → Manually triggers alert check

* `POST /api/v1/alerts/history/:id/resolve` (requires JWT, admin/developer role)
  → Resolves alert

### Policies (Phase 4)

* `GET /api/v1/policies` (requires JWT)
  → Returns policies

* `GET /api/v1/policies/:id` (requires JWT)
  → Returns policy

* `POST /api/v1/policies` (requires JWT, admin role)
  **Body:**
  ```json
  {
    "name": "Restrict High Risk Tools",
    "description": "Deny high risk tools in auto mode",
    "scope": "global",
    "rule_expr": {
      "conditions": [
        {
          "field": "tool.risk_level",
          "operator": "equals",
          "value": "high"
        },
        {
          "field": "run.mode",
          "operator": "equals",
          "value": "auto"
        }
      ],
      "logic": "AND"
    },
    "effect": "deny",
    "priority": 100
  }
  ```
  → Creates policy

* `PATCH /api/v1/policies/:id` (requires JWT, admin role)
  → Updates policy

* `DELETE /api/v1/policies/:id` (requires JWT, admin role)
  → Deletes policy

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

## 9. Deployment & Environments

### 9.1. Monorepo Strategy

The repository is a **Monorepo** with two distinct deployment targets:

1. **Backend (`/backend`)**:
   * Deployed to **Vercel**.
   * Serverless functions + Postgres.
   * Triggers: Changes in `backend/**`.

2. **Executor (`/executor`)**:
   * Deployed to **Railway**.
   * Docker container (Node.js + Puppeteer/Python).
   * Triggers: Changes in `executor/**`.

### 9.2. Vercel (Brain) Setup

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

### 9.3. Railway (Muscle) Setup

* **Service**: Dockerfile based deployment.
* **Environment Variables**:
  * `PORT`: 8080
  * `LOGLINE_SHARED_SECRET`: (Must match Backend's secret)

### 9.4. Environment Variables (Backend)

**Required:**
* `POSTGRES_URL` - Automatically set by Vercel Postgres
* `OPENAI_API_KEY` - For LLM calls (or other provider keys)
* `NODE_ENV` - Set automatically by Vercel
* `LOGLINE_EXECUTOR_URL` - URL of the deployed Railway service (e.g., `https://executor-production.up.railway.app`)
* `LOGLINE_SHARED_SECRET` - Shared secret for signing requests to Executor

**Optional:**
* `ANTHROPIC_API_KEY` - For Claude models
* `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models
* `LOG_LEVEL` - Logging level (default: info)

### 9.5. Deployment Steps

1. **Connect Repository to Vercel**
   * Set root directory to `backend`.
   * Vercel will auto-deploy changes to backend.

2. **Connect Repository to Railway**
   * Set root directory to `executor`.
   * Railway will auto-deploy changes to executor.

3. **Configure Secrets**
   * Ensure `LOGLINE_SHARED_SECRET` is identical in both environments.

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
### Phase 1.5 – Serverless Optimizations (✅ COMPLETE)
### Phase 2 – Agents, Tools & LLM Integration (✅ COMPLETE)
### Phase 3 – App Layer & Developer Surface (✅ COMPLETE)
### Phase 4 – Memory, Governance, and UX Polish (✅ COMPLETE)

### Phase 5 – Registry Universal (✅ COMPLETE)

**Goal:** Create a centralized, multitenant Universal Registry for managing Apps, People, Agents, Contracts, Ideas, and Objects.

**Delivered:**
* ✅ **People**: Universal Identity (LogLine ID) + Auth Bridge.
* ✅ **Objects**: Trackable items + Services + Ownership History.
* ✅ **Agents**: Identity, Training History, Execution Logs, Contracts.
* ✅ **Contracts**: State Machine (Draft -> Active -> Completed), Penalties, Templates.
* ✅ **Ideas**: Collaborative Voting, Cost/Priority Matrix.
* ✅ **Apps**: Marketplace Metadata.
* ✅ **Financials**: All values refactored to Integer Cents.

### Phase 6 – LogLine Executor (✅ COMPLETE)

**Goal:** Extend the platform with a "Muscle" component for heavy-duty tasks.

**Delivered:**
* ✅ **Architecture**: Hybrid Vercel (Brain) + Railway (Muscle).
* ✅ **Security**: HMAC-SHA256 signature verification.
* ✅ **Executor Service**: Node.js/Express app on Railway.
* ✅ **Tools**: `code_interpreter` (Python/JS), `web_browser` (Puppeteer).
* ✅ **Integration**: `ToolRuntimeService` proxies `remote` tools to Executor.

### Phase 5.X – Registry Integration & Wiring (🚧 IN PROGRESS)

**Goal:** Connect the "Brain" (Registry/Logic) with the "Muscle" (Executor/Agents) to create a fully integrated, LLM-first OS.

**Tasks:**
* [ ] **Registry Tools**: Expose Registry functions (Lookup Person, Check Contract) as agent tools.
* [ ] **Contract Context**: Inject active contract details into Agent System Prompt.
* [ ] **Event Emission**: Emit events for Registry changes (Contract Signed, Object Moved).
* [ ] **Full System Test**: Verify end-to-end flow (User -> Idea -> Contract -> Agent -> Execution).

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

### Core Design & Philosophy
- [LLM-First Design Review](./docs/design/LLM_FIRST_DESIGN_REVIEW.md)
- [AI Partner Philosophy](./docs/design/AI_PARTNER_PHILOSOPHY.md)
- [Dignified AI Partnership Implementation](./docs/design/DIGNIFIED_AI_PARTNERSHIP_IMPLEMENTATION.md)
- [Codebase Review 2024](./CODEBASE_REVIEW_2024.md)

### Architecture
- [Registry Universal Proposal](./docs/design/REGISTRY_UNIVERSAL_PROPOSAL.md)
- [Executor Spec](./docs/architecture/EXECUTOR_SPEC.md)
- [Frontend App Guidelines](./docs/architecture/FRONTEND_APP_GUIDELINES.md)

### External Resources
- [Vercel AI SDK v5](https://v5.ai-sdk.dev/)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Railway Documentation](https://docs.railway.app/)

---

**End of Master Blueprint**
