# Phase 4: Memory, Governance, and UX Polish

**Goal:** Make it **LLM-first AND enterprise-safe**.

**Status:** Planning  
**Blueprint Version:** 2.3  
**Date:** 2024-12-XX

---

## Overview

Phase 4 transforms the platform from a functional execution engine into an enterprise-ready, memory-enabled system with comprehensive governance, authentication, and observability.

### Key Objectives

1. **Memory Engine (RAG-enabled)**: Enable agents to store and retrieve context across runs
2. **Policy Engine v1**: Upgrade from v0 to a full rule-based policy system
3. **Authentication & RBAC**: Secure the platform with user authentication and role-based access control
4. **Studio UI**: Admin interface for managing the platform
5. **Hardening**: Audit logging, metrics, alerts

---

## Part 1: Memory Engine (RAG-enabled)

### 1.1. Database Schema

**Migration:** `0006-create-memory-tables.ts`

```sql
-- Memory items (user/tenant/app/agent/run-scoped memories)
CREATE TABLE memory_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type   TEXT NOT NULL, -- user|tenant|app|agent|run
  owner_id     UUID NOT NULL,
  type         TEXT NOT NULL, -- short_term|long_term|profile
  content      TEXT NOT NULL,
  metadata     JSONB,
  embedding    vector(1536), -- OpenAI embedding dimension
  visibility   TEXT NOT NULL DEFAULT 'private', -- private|org|public
  ttl          TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_owner ON memory_items(owner_type, owner_id);
CREATE INDEX idx_memory_type ON memory_items(owner_type, owner_id, type);
CREATE INDEX idx_memory_embedding ON memory_items 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Resources for RAG (chunked content, documents, etc.)
CREATE TABLE resources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  content      TEXT NOT NULL,
  metadata     JSONB,
  embedding    vector(1536),
  memory_item_id UUID REFERENCES memory_items(id) ON DELETE CASCADE,
  chunk_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resources_memory ON resources(memory_item_id);
CREATE INDEX idx_resources_embedding ON resources 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);
```

### 1.2. Embedding Service

**File:** `backend/src/memory/embedding.service.ts`

- Use Vercel AI SDK's `embed` function
- Support multiple providers (OpenAI, Anthropic, Google)
- Cache embeddings to reduce API calls
- Batch processing for multiple texts

**Key Features:**
- Automatic embedding generation on memory store
- Configurable embedding model per tenant/app
- Embedding dimension detection (1536 for OpenAI, 768 for others)

### 1.3. Memory Service

**File:** `backend/src/memory/memory.service.ts`

**Core Methods:**
- `storeMemory(ownerType, ownerId, type, content, metadata?)` → stores with embedding
- `retrieveMemory(ownerType, ownerId, type, limit?)` → retrieves by owner
- `searchMemory(query, ownerType?, ownerId?, limit?, threshold?)` → semantic search
- `deleteMemory(memoryId)` → soft delete or hard delete
- `updateMemory(memoryId, content, metadata?)` → updates with new embedding

**Features:**
- Automatic chunking for large content (>1000 tokens)
- TTL support for short-term memories
- Visibility controls (private/org/public)
- Metadata filtering

### 1.4. Memory Tools

**File:** `backend/src/tools/memory.tool.ts`

**Tools:**
1. `memory.store` - Store a memory item
   - Input: `{ owner_type, owner_id, type, content, metadata?, ttl? }`
   - Output: `{ memory_id, stored_at }`

2. `memory.retrieve` - Retrieve memories by owner
   - Input: `{ owner_type, owner_id, type?, limit? }`
   - Output: `{ memories: [...] }`

3. `memory.search` - Semantic search across memories
   - Input: `{ query, owner_type?, owner_id?, type?, limit?, threshold? }`
   - Output: `{ results: [{ memory_id, content, similarity, ... }] }`

4. `memory.delete` - Delete a memory item
   - Input: `{ memory_id }`
   - Output: `{ deleted: true }`

### 1.5. Integration with Agent Runtime

**Modifications to:** `backend/src/agents/agent-runtime.service.ts`

- Add memory tools to agent's available tools (if allowed)
- Automatically inject relevant memories into agent context
- Store agent decisions/conclusions as long-term memories
- Support memory retrieval in workflow context

### 1.6. RAG Workflow Pattern

**Example Workflow:**
```json
{
  "entry": "start",
  "nodes": [
    { "id": "start", "type": "static" },
    {
      "id": "search_memory",
      "type": "tool_node",
      "config": { "tool_id": "memory.search" }
    },
    {
      "id": "agent_with_context",
      "type": "agent_node",
      "config": { "agent_id": "agent.knowledge_assistant" }
    },
    {
      "id": "store_insight",
      "type": "tool_node",
      "config": { "tool_id": "memory.store" }
    }
  ],
  "edges": [
    { "from": "start", "to": "search_memory" },
    { "from": "search_memory", "to": "agent_with_context" },
    { "from": "agent_with_context", "to": "store_insight" }
  ]
}
```

---

## Part 2: Policy Engine v1

### 2.1. Database Schema

**Migration:** `0007-create-policies-table.ts`

```sql
CREATE TABLE policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  scope       TEXT NOT NULL, -- global|tenant|app|tool|workflow|agent
  scope_id    UUID, -- nullable, ID of the scoped entity
  rule_expr   JSONB NOT NULL, -- DSL/JSON for engine to evaluate
  effect      TEXT NOT NULL, -- allow|deny|require_approval|modify
  priority    INTEGER NOT NULL DEFAULT 100, -- lower = higher priority
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_scope ON policies(scope, scope_id);
CREATE INDEX idx_policies_enabled ON policies(enabled, priority);
```

### 2.2. Policy Rule Language (DSL)

**Simple JSON-based DSL:**

```json
{
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
  "logic": "AND" // AND | OR
}
```

**Supported Operators:**
- `equals`, `not_equals`
- `in`, `not_in`
- `greater_than`, `less_than`
- `contains`, `starts_with`, `ends_with`
- `exists`, `not_exists`

**Supported Fields:**
- `tool.risk_level`, `tool.id`, `tool.side_effects`
- `run.mode`, `run.app_id`, `run.user_id`, `run.tenant_id`
- `agent.id`, `agent.allowed_tools`
- `user.role`, `user.permissions`
- `app.id`, `app.visibility`

### 2.3. Policy Engine Service

**File:** `backend/src/policies/policy-engine-v1.service.ts`

**Core Methods:**
- `evaluatePolicy(policy, context)` → evaluates a single policy
- `evaluatePolicies(context)` → evaluates all applicable policies
- `checkToolCall(toolId, context)` → checks if tool call is allowed
- `checkRunStart(workflowId, context)` → checks if run can start
- `checkMemoryAccess(memoryId, context)` → checks memory access

**Evaluation Flow:**
1. Load all applicable policies (by scope)
2. Sort by priority
3. Evaluate each policy's conditions
4. Apply effect (allow/deny/require_approval/modify)
5. Return first non-allow decision or allow if all pass

**Integration Points:**
- `ToolRuntimeService` - before tool execution
- `OrchestratorService` - before run start
- `MemoryService` - before memory access
- `AppsRuntimeController` - before action execution

### 2.4. Policy API

**Endpoints:**
- `GET /policies` - List all policies
- `POST /policies` - Create a policy
- `GET /policies/:id` - Get policy details
- `PATCH /policies/:id` - Update policy
- `DELETE /policies/:id` - Delete policy
- `POST /policies/:id/test` - Test policy with sample context

### 2.5. Migration from Policy Engine v0

- Keep `PolicyEngineV0Service` for backward compatibility
- `PolicyEngineV1Service` wraps v0 and adds database policies
- Gradual migration: v0 rules → v1 policies
- Feature flag: `USE_POLICY_ENGINE_V1=true`

---

## Part 3: Authentication & RBAC

### 3.1. Database Schema

**Migration:** `0008-create-auth-tables.ts`

```sql
-- Users
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT, -- nullable for OAuth users
  name         TEXT,
  avatar_url   TEXT,
  role         TEXT NOT NULL DEFAULT 'user', -- user|admin|developer
  tenant_id    UUID, -- nullable, for multi-tenancy
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Sessions (JWT refresh tokens)
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

-- API Keys (for programmatic access)
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  permissions  TEXT[] NOT NULL DEFAULT '{}',
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### 3.2. Authentication Service

**File:** `backend/src/auth/auth.service.ts`

**Methods:**
- `register(email, password, name?)` → creates user
- `login(email, password)` → returns JWT tokens
- `refreshToken(refreshToken)` → returns new access token
- `logout(token)` → invalidates session
- `validateToken(token)` → validates JWT
- `getUserFromToken(token)` → extracts user from token

**JWT Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "user",
  "tenant_id": "tenant_id",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### 3.3. Auth Guards

**Files:**
- `backend/src/auth/guards/jwt-auth.guard.ts` - JWT validation
- `backend/src/auth/guards/roles.guard.ts` - Role-based access
- `backend/src/auth/decorators/roles.decorator.ts` - `@Roles('admin')`
- `backend/src/auth/decorators/current-user.decorator.ts` - `@CurrentUser()`

### 3.4. RBAC Service

**File:** `backend/src/auth/rbac.service.ts`

**Methods:**
- `hasPermission(user, resource, action)` → checks permission
- `getUserPermissions(user)` → returns user's permissions
- `assignRole(userId, role)` → assigns role
- `revokeRole(userId, role)` → revokes role

**Permission Model:**
- Roles: `admin`, `developer`, `user`
- Resources: `workflow`, `tool`, `agent`, `app`, `memory`, `policy`
- Actions: `create`, `read`, `update`, `delete`, `execute`

### 3.5. Auth API

**Endpoints:**
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (returns JWT)
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout (invalidates session)
- `GET /auth/me` - Get current user
- `PATCH /auth/me` - Update current user
- `POST /auth/api-keys` - Create API key
- `GET /auth/api-keys` - List API keys
- `DELETE /auth/api-keys/:id` - Revoke API key

### 3.6. Integration with Existing APIs

- Add `@UseGuards(JwtAuthGuard)` to protected endpoints
- Extract `user_id` and `tenant_id` from JWT token
- Pass to `ToolContext`, `AgentContext`, etc.
- Enforce RBAC in controllers

---

## Part 4: Studio UI (Admin Interface)

### 4.1. Core Features

**Dashboard:**
- Overview metrics (runs, errors, policy hits)
- Recent runs with status
- Top apps by usage
- Cost tracking (LLM calls, tokens)

**Runs Management:**
- List all runs with filters (status, app, user, date)
- Inspect run details (steps, events, trace)
- Replay failed runs
- Export run data

**Workflows Management:**
- CRUD for workflows
- Visual workflow editor (future)
- Workflow versioning
- Test workflow execution

**Tools & Agents:**
- CRUD for tools and agents
- Test tool/agent execution
- View tool usage statistics
- Agent performance metrics

**Apps Management:**
- List all apps
- Import/export app manifests
- App usage analytics
- App scope management

**Policies Management:**
- CRUD for policies
- Test policy evaluation
- Policy hit logs
- Policy performance metrics

**Memory Management:**
- Browse memories by owner
- Search memories semantically
- Memory usage statistics
- Cleanup old memories

**Users & Access:**
- User management
- Role assignment
- API key management
- Audit logs

### 4.2. Technology Stack

**Options:**
1. **Next.js App Router** (recommended)
   - Server components for data fetching
   - Client components for interactivity
   - API routes for backend integration
   - Tailwind CSS for styling

2. **React + Vite**
   - Separate frontend app
   - React Query for data fetching
   - React Router for navigation

3. **Vercel AI SDK UI Components**
   - Pre-built chat components
   - Streaming support
   - Tool calling UI

### 4.3. API Integration

- Use existing backend APIs
- Add authentication headers
- Handle SSE streams for real-time updates
- Error handling and retry logic

---

## Part 5: Hardening

### 5.1. Audit Logging

**Enhancement to:** `backend/src/runs/entities/event.entity.ts`

**New Event Kinds:**
- `auth.login`, `auth.logout`, `auth.failed_login`
- `policy.created`, `policy.updated`, `policy.deleted`
- `user.created`, `user.updated`, `user.deleted`
- `app.imported`, `app.updated`
- `memory.stored`, `memory.deleted`

**Audit Log Table:**
```sql
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  action       TEXT NOT NULL, -- create|update|delete|execute
  resource_type TEXT NOT NULL, -- workflow|tool|agent|app|policy|memory
  resource_id  UUID,
  changes      JSONB, -- before/after for updates
  ip_address    TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

### 5.2. Metrics & Monitoring

**Metrics Endpoint:** `GET /metrics` (Prometheus format)

**Key Metrics:**
- `runs_total` - Total runs by status
- `runs_duration_seconds` - Run execution time
- `llm_calls_total` - LLM API calls by provider
- `llm_tokens_total` - Tokens consumed
- `tool_calls_total` - Tool executions by tool_id
- `policy_evaluations_total` - Policy checks by result
- `memory_operations_total` - Memory store/retrieve/search
- `errors_total` - Errors by type

**Integration:**
- Vercel Analytics (automatic)
- Custom metrics endpoint for Prometheus
- Log aggregation (Vercel Logs)

### 5.3. Alerts

**Alert Rules:**
- High error rate (>5% of runs failing)
- Budget exceeded (cost/LLM calls/latency)
- Policy denials spike
- Memory usage threshold
- API rate limit approaching

**Notification Channels:**
- Email (via SendGrid/Resend)
- Slack webhook
- PagerDuty (for critical alerts)

**Implementation:**
- Background job (Vercel Cron)
- Check metrics every 5 minutes
- Send alerts when thresholds exceeded

### 5.4. Rate Limiting

**Implementation:**
- Per-user rate limits
- Per-tenant rate limits
- Per-API-key rate limits
- Global rate limits

**Storage:**
- Redis (Upstash Redis on Vercel)
- In-memory cache (fallback)

---

## Implementation Order

### Phase 4.1: Memory Engine (Week 1-2)
1. Database schema (migration)
2. Embedding service
3. Memory service
4. Memory tools
5. Integration with agent runtime
6. Tests

### Phase 4.2: Policy Engine v1 (Week 3-4)
1. Database schema (migration)
2. Policy rule DSL
3. Policy engine service
4. Policy API
5. Integration with tool runtime
6. Migration from v0
7. Tests

### Phase 4.3: Authentication & RBAC (Week 5-6)
1. Database schema (migration)
2. Auth service (JWT)
3. Auth guards and decorators
4. RBAC service
5. Auth API
6. Integration with existing APIs
7. Tests

### Phase 4.4: Studio UI (Week 7-8)
1. Next.js setup
2. Dashboard
3. Runs management
4. Workflows/Tools/Agents management
5. Apps management
6. Policies management
7. Memory management
8. Users & access

### Phase 4.5: Hardening (Week 9-10)
1. Audit logging
2. Metrics endpoint
3. Alerts system
4. Rate limiting
5. Documentation
6. Security review

---

## Testing Strategy

### Unit Tests
- Memory service (store, retrieve, search)
- Policy engine (rule evaluation)
- Auth service (JWT, password hashing)
- RBAC service (permission checks)

### Integration Tests
- Memory tools in workflow
- Policy enforcement in tool calls
- Auth flow (register, login, refresh)
- RBAC enforcement in APIs

### E2E Tests
- Full RAG workflow (store → search → retrieve)
- Policy evaluation in real workflow
- User registration → workflow execution
- Studio UI workflows

---

## Success Criteria

**Phase 4 is complete when:**

1. ✅ Agents can store and retrieve memories across runs
2. ✅ Semantic search works for memory retrieval
3. ✅ Policy Engine v1 evaluates rules from database
4. ✅ Users can register, login, and access APIs with JWT
5. ✅ RBAC enforces permissions on all resources
6. ✅ Studio UI allows managing all platform resources
7. ✅ Audit logs track all important actions
8. ✅ Metrics endpoint provides observability
9. ✅ Alerts notify on critical issues
10. ✅ Rate limiting prevents abuse

---

## References

### Memory & RAG
- [Vercel AI SDK Embeddings](https://sdk.vercel.ai/docs/reference/ai-sdk-core/embed)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

### Policy Engine
- [OPA (Open Policy Agent)](https://www.openpolicyagent.org/) - Reference for policy DSL
- [Casbin](https://casbin.org/) - Access control library

### Authentication
- [NestJS Passport](https://docs.nestjs.com/security/authentication)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

### Observability
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Vercel Analytics](https://vercel.com/docs/analytics)

---

**Next Steps:**
1. Review and approve this plan
2. Create detailed task breakdown
3. Start with Phase 4.1 (Memory Engine)
4. Iterate based on feedback

