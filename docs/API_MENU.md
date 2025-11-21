# 🍽️ Menu do Backend - O que um Frontend-App pode usar

**Versão:** 1.0  
**Data:** 2024-12-19  
**Base URL:** `/api/v1`

---

## 📋 Índice

1. [Autenticação e Usuários](#1-autenticação-e-usuários)
2. [Workflows (Automações)](#2-workflows-automações)
3. [Runs (Execuções)](#3-runs-execuções)
4. [Apps (Aplicações)](#4-apps-aplicações)
5. [Agents (Agentes LLM)](#5-agents-agentes-llm)
6. [Tools (Ferramentas)](#6-tools-ferramentas)
7. [Files (Arquivos)](#7-files-arquivos)
8. [Memory (Memória RAG)](#8-memory-memória-rag)
9. [Policies (Políticas de Governança)](#9-policies-políticas-de-governança)
10. [Metrics (Métricas e Observabilidade)](#10-metrics-métricas-e-observabilidade)
11. [Audit (Auditoria)](#11-audit-auditoria)
12. [Alerts (Alertas)](#12-alerts-alertas)
13. [Health & Info](#13-health--info)
14. [Streaming (Server-Sent Events)](#14-streaming-server-sent-events)
15. [Headers Importantes](#15-headers-importantes)
16. [Modos de Execução](#16-modos-de-execução)
17. [Budgets (Orçamentos)](#17-budgets-orçamentos)
18. [Error Handling](#18-error-handling)

---

## 1. Autenticação e Usuários

### 🔐 Autenticação

#### Registrar Novo Usuário
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "User Name",
  "tenant_id": "tenant-abc" // opcional
}
```

**Resposta:**
```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "tenant_id": "tenant-abc",
    "role": "user"
  },
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Resposta:** Mesmo formato do register

#### Renovar Access Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "jwt_refresh_token"
}
```

**Resposta:**
```json
{
  "access_token": "new_jwt_access_token"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refresh_token": "jwt_refresh_token"
}
```

#### Obter Usuário Atual
```http
GET /auth/me
Authorization: Bearer <access_token>
```

**Resposta:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "tenant_id": "tenant-abc",
  "role": "user"
}
```

#### Atualizar Perfil
```http
PATCH /auth/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Name",
  "avatar_url": "https://..."
}
```

### 🔑 API Keys

#### Criar API Key
```http
POST /auth/api-keys
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My API Key",
  "permissions": ["read", "write"],
  "expires_at": "2025-12-31T23:59:59Z" // opcional
}
```

**Resposta:** ⚠️ A key é retornada apenas UMA VEZ
```json
{
  "id": "key-uuid",
  "name": "My API Key",
  "key": "llm_xxxxxxxxxxxxx", // ⚠️ Mostrado apenas na criação
  "permissions": ["read", "write"],
  "expires_at": "2025-12-31T23:59:59Z",
  "created_at": "2024-12-19T10:00:00Z"
}
```

#### Listar API Keys
```http
GET /auth/api-keys
Authorization: Bearer <access_token>
```

#### Revogar API Key
```http
POST /auth/api-keys/:id/revoke
Authorization: Bearer <access_token>
```

---

## 2. Workflows (Automações)

### 📋 Gerenciamento

#### Listar Workflows
```http
GET /workflows?page=1&limit=10
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "workflow-uuid",
      "name": "Ticket Triage",
      "version": "1.0.0",
      "type": "linear",
      "definition": { ... }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

#### Obter Workflow
```http
GET /workflows/:id
```

#### Criar Workflow
```http
POST /workflows
Content-Type: application/json

{
  "name": "My Workflow",
  "version": "1.0.0",
  "type": "linear",
  "definition": {
    "nodes": [...],
    "edges": [...]
  }
}
```

#### Atualizar Workflow
```http
PATCH /workflows/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "definition": { ... }
}
```

#### Deletar Workflow
```http
DELETE /workflows/:id
```

### ▶️ Execução

#### Iniciar Execução
```http
POST /workflows/:id/runs
Content-Type: application/json

{
  "input": {
    "hotel_id": "VV-LISBON"
  },
  "mode": "draft", // "draft" | "auto"
  "tenant_id": "tenant-abc",
  "user_id": "user-123",
  "cost_limit_cents": 1000, // opcional
  "llm_calls_limit": 50, // opcional
  "latency_slo_ms": 30000 // opcional
}
```

**Resposta:** Retorna imediatamente, execução em background
```json
{
  "id": "run-uuid",
  "workflow_id": "workflow-uuid",
  "status": "running",
  "mode": "draft",
  "input": { ... },
  "result": null,
  "created_at": "2024-12-19T10:00:00Z"
}
```

---

## 3. Runs (Execuções)

### 📊 Consulta

#### Obter Detalhes de Execução
```http
GET /runs/:id
```

**Resposta:**
```json
{
  "id": "run-uuid",
  "workflow_id": "workflow-uuid",
  "status": "completed", // "pending" | "running" | "completed" | "failed" | "paused" | "cancelled"
  "mode": "draft",
  "input": { ... },
  "result": {
    "summary": "N tickets triaged",
    "tickets": [...]
  },
  "created_at": "2024-12-19T10:00:00Z",
  "updated_at": "2024-12-19T10:01:00Z"
}
```

#### Obter Eventos/Trace
```http
GET /runs/:id/events
```

**Resposta:**
```json
[
  {
    "id": "event-uuid",
    "kind": "run_started",
    "payload": { ... },
    "ts": "2024-12-19T10:00:00Z"
  },
  {
    "kind": "step_started",
    "payload": {
      "node_id": "fetch_tickets",
      "node_type": "tool_node"
    }
  },
  {
    "kind": "tool_call",
    "payload": {
      "tool_id": "ticketing.list_open"
    }
  },
  {
    "kind": "llm_call",
    "payload": {
      "agent_id": "agent.ticket_triage",
      "model": "gpt-4o",
      "usage": { "promptTokens": 100, "completionTokens": 50 }
    }
  },
  {
    "kind": "run_completed",
    "payload": { ... }
  }
]
```

#### Stream em Tempo Real (SSE)
```http
GET /runs/:id/stream
Accept: text/event-stream
```

**Eventos SSE:**
```
data: {"type": "connected", "runId": "run-uuid"}

data: {"type": "update", "run": {...}, "events": [...]}

data: {"type": "complete", "status": "completed"}
```

Atualiza a cada 500ms. Fecha automaticamente quando completa/falha.

### ⏯️ Controle

#### Retomar Execução Pausada
```http
PATCH /runs/:id/resume
Content-Type: application/json

{
  "approval_input": {
    "approved": true,
    "comment": "Looks good"
  }
}
```

Usado quando um run está em `status: "paused"` aguardando aprovação humana.

---

## 4. Apps (Aplicações)

### 📦 Gerenciamento

#### Listar Apps
```http
GET /apps
```

**Resposta:**
```json
[
  {
    "id": "app-uuid",
    "name": "Ticket Manager",
    "description": "App for managing tickets",
    "visibility": "private", // "private" | "org" | "public"
    "scopes": [...],
    "workflows": [...],
    "actions": [...]
  }
]
```

#### Obter App
```http
GET /apps/:app_id
```

**Resposta:** Inclui scopes, workflows e actions

#### Importar App Manifest
```http
POST /apps/import
Content-Type: application/json

{
  "version": "1.0.0",
  "app": {
    "id": "ticket-manager",
    "name": "Ticket Manager",
    "description": "...",
    "visibility": "private"
  },
  "scopes": [
    {
      "scope_type": "tool",
      "scope_value": "natural_language_db_read"
    }
  ],
  "workflows": [
    {
      "alias": "main",
      "label": "Main Workflow",
      "workflow_id": "workflow-uuid",
      "default_mode": "draft"
    }
  ],
  "actions": [
    {
      "action_id": "start_chat",
      "label": "Start Chat",
      "workflow_alias": "main",
      "input_mapping": {
        "message": "$context.message",
        "user_id": "$context.user_id"
      }
    }
  ]
}
```

### ▶️ Execução de Actions

#### Executar Action
```http
POST /apps/:app_id/actions/:action_id
Content-Type: application/json

{
  "event": {
    "message": "Hello",
    "user_name": "John"
  },
  "context": {
    "user_id": "user-123",
    "tenant_id": "tenant-abc",
    "mode": "draft" // opcional, sobrescreve default_mode
  }
}
```

**Resposta:**
```json
{
  "run_id": "run-uuid",
  "status": "pending",
  "workflow_id": "workflow-uuid",
  "app_id": "app-uuid",
  "app_action_id": "start_chat"
}
```

O backend:
1. Resolve `input_mapping` usando `$context.*` e `$event.*`
2. Verifica policies
3. Inicia o workflow com input mapeado
4. Retorna `run_id` imediatamente

### 📋 Informações

#### Listar Actions
```http
GET /apps/:app_id/actions
```

**Resposta:**
```json
[
  {
    "id": "start_chat",
    "label": "Start Chat",
    "workflow_id": "workflow-uuid",
    "workflow_alias": "main",
    "input_mapping": { ... }
  }
]
```

#### Obter Scopes
```http
GET /apps/:app_id/scopes
```

**Resposta:**
```json
{
  "app_id": "app-uuid",
  "scopes": [
    {
      "type": "tool",
      "value": "natural_language_db_read"
    },
    {
      "type": "memory",
      "value": "memory.search"
    }
  ]
}
```

---

## 5. Agents (Agentes LLM)

### 🤖 Gerenciamento

#### Listar Agents
```http
GET /agents
```

**Resposta:**
```json
[
  {
    "id": "agent.ticket_triage",
    "name": "Ticket Triage Agent",
    "instructions": "You are a helpful assistant...",
    "model_profile": {
      "provider": "openai",
      "model": "gpt-4o",
      "temperature": 0.7,
      "max_tokens": 2000
    },
    "allowed_tools": ["natural_language_db_read", "memory.search"]
  }
]
```

#### Obter Agent
```http
GET /agents/:id
```

#### Criar/Atualizar Agent
```http
POST /agents
Content-Type: application/json

{
  "id": "agent.my-agent",
  "name": "My Agent",
  "instructions": "You are a helpful assistant.",
  "model_profile": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 2000
  },
  "allowed_tools": ["natural_language_db_read"]
}
```

### 💬 Conversação (Streaming)

#### Conversar com Agent
```http
POST /agents/:id/conversation
Content-Type: application/json
Accept: text/event-stream

{
  "message": "Hello, how can you help me?",
  "context": {
    "user_id": "user-123",
    "tenant_id": "tenant-abc"
  },
  "conversation_id": "conv-123" // opcional, para continuar conversa
}
```

**Resposta SSE:**
```
data: {"type": "connected", "runId": "run-uuid", "stepId": "step-uuid"}

data: {"type": "text", "content": "Hello! I can help you with..."}

data: {"type": "tool_call", "toolCall": {
  "toolId": "memory.search",
  "toolName": "memory.search",
  "args": {...},
  "result": {...}
}}

data: {"type": "complete", "runId": "run-uuid", "result": "..."}
```

O agent pode:
- Responder em texto
- Chamar tools automaticamente
- Acessar memória (RAG)
- Manter contexto da conversa

---

## 6. Tools (Ferramentas)

### 🔧 Consulta

#### Listar Tools
```http
GET /tools
```

**Resposta:**
```json
[
  {
    "id": "natural_language_db_read",
    "name": "Natural Language DB Read",
    "description": "Query the database using natural language. READ-ONLY operations.",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Natural language question"
        }
      }
    },
    "handler_type": "builtin",
    "risk_level": "medium", // "low" | "medium" | "high"
    "side_effects": ["database_read"]
  }
]
```

#### Obter Tool
```http
GET /tools/:id
```

#### Criar/Atualizar Tool
```http
POST /tools
Content-Type: application/json

{
  "id": "my-custom-tool",
  "name": "My Custom Tool",
  "description": "...",
  "input_schema": { ... },
  "handler_type": "code",
  "handler_config": { ... },
  "risk_level": "low"
}
```

### 🛠️ Tools Built-in Disponíveis

#### Natural Language DB Read
- **ID:** `natural_language_db_read`
- **Descrição:** Consultar banco de dados em linguagem natural (READ-ONLY)
- **Input:** `{ query: "How many users are active?" }`
- **Segurança:** Transações READ-ONLY, validação de SELECT, LIMIT automático
- **Risk Level:** `medium`

#### Natural Language DB Write
- **ID:** `natural_language_db_write`
- **Descrição:** Escrever no banco em linguagem natural (com segurança)
- **Input:** `{ query: "Create a new user with name John" }`
- **Segurança:** Validação de SQL, bloqueio de DROP/ALTER, app scope required
- **Risk Level:** `high`

#### Memory Tools
- **ID:** `memory.store` - Armazenar memória
- **ID:** `memory.retrieve` - Recuperar memória por ID
- **ID:** `memory.search` - Buscar memórias (RAG semântico)
- **ID:** `memory.delete` - Deletar memória

**Exemplo Memory Search:**
```json
{
  "query": "What did the user ask about last week?",
  "owner_type": "user",
  "owner_id": "user-123",
  "type": "long_term",
  "limit": 10,
  "threshold": 0.7
}
```

---

## 7. Files (Arquivos)

### 📁 Gerenciamento

#### Criar/Upload Arquivo
```http
POST /files
Content-Type: application/json

{
  "path": "documents/report.pdf",
  "content": "base64_encoded_content...",
  "run_id": "run-uuid", // opcional
  "app_id": "app-uuid" // opcional
}
```

**Resposta:**
```json
{
  "id": "file-uuid",
  "path": "documents/report.pdf",
  "size": 1024,
  "run_id": "run-uuid",
  "created_at": "2024-12-19T10:00:00Z"
}
```

#### Obter Arquivo
```http
GET /files/:id
```

**Resposta:**
```json
{
  "id": "file-uuid",
  "path": "documents/report.pdf",
  "content": "base64_encoded_content...",
  "size": 1024
}
```

#### Atualizar Arquivo
```http
PUT /files/:id
Content-Type: application/json

{
  "content": "new_base64_content..."
}
```

#### Deletar Arquivo
```http
DELETE /files/:id
```

### 📋 Consultas

#### Listar Arquivos de Run
```http
GET /files/runs/:runId
```

#### Listar Arquivos de App
```http
GET /files/apps/:appId
```

### 📦 Transferência Chunked (Mobile)

#### Obter Chunk
```http
GET /files/:id/chunks?chunk=0&size=65536
```

**Query Params:**
- `chunk` - Índice do chunk (default: 0)
- `size` - Tamanho do chunk em bytes (default: 65536, max: 1MB)

**Resposta:**
```json
{
  "chunkIndex": 0,
  "totalChunks": 10,
  "chunkSize": 65536,
  "content": "base64_chunk_content...",
  "isLast": false
}
```

**Headers:**
- `X-Chunk-Index`: Índice do chunk atual
- `X-Total-Chunks`: Total de chunks

Útil para arquivos grandes em mobile (iOS/Android).

---

## 8. Memory (Memória RAG)

### 🧠 Operações via Tools

As operações de memória são feitas via **tools** (seção 6), mas o backend oferece:

#### Armazenamento
- **Embeddings automáticos** (pgvector)
- **Tipos:** `short_term`, `long_term`, `profile`
- **Owners:** `user`, `tenant`, `app`, `agent`, `run`
- **Visibilidade:** `private`, `org`, `public`
- **TTL opcional** (Time To Live)

#### Busca Semântica
- **Busca por similaridade** (cosine similarity)
- **Filtros por metadata** (JSONB)
- **Filtros por type/owner**
- **Threshold configurável**

#### Exemplo de Uso
```json
// Via tool memory.search
{
  "query": "What did the user ask about last week?",
  "owner_type": "user",
  "owner_id": "user-123",
  "type": "long_term",
  "limit": 10,
  "threshold": 0.7,
  "metadata": {
    "category": "support"
  }
}
```

**Resposta:**
```json
[
  {
    "memory_id": "memory-uuid",
    "content": "User asked about refund policy",
    "similarity": 0.85,
    "metadata": { "category": "support", "date": "2024-12-12" }
  }
]
```

---

## 9. Policies (Políticas de Governança)

### 📜 Gerenciamento (Admin/Developer)

#### Listar Policies
```http
GET /policies?scope=app&scope_id=app-uuid&enabled=true
```

**Query Params:**
- `scope` - Filtrar por scope (`global`, `tenant`, `app`, `tool`, `workflow`, `agent`)
- `scope_id` - Filtrar por ID do scope
- `enabled` - Filtrar por enabled (`true`/`false`)

**Resposta:**
```json
[
  {
    "id": "policy-uuid",
    "name": "High Risk Tools Require Approval",
    "description": "...",
    "scope": "tool",
    "scope_id": "natural_language_db_write",
    "rule_expr": {
      "condition": {
        "risk_level": "high",
        "mode": "auto"
      },
      "effect": "require_approval"
    },
    "enabled": true,
    "created_at": "2024-12-19T10:00:00Z"
  }
]
```

#### Obter Policy
```http
GET /policies/:id
```

#### Criar Policy
```http
POST /policies
Content-Type: application/json

{
  "name": "My Policy",
  "description": "Policy description",
  "scope": "app", // "global" | "tenant" | "app" | "tool" | "workflow" | "agent"
  "scope_id": "app-uuid", // opcional, dependendo do scope
  "rule_expr": {
    "condition": {
      "risk_level": "high",
      "mode": "auto"
    },
    "effect": "require_approval" // "allow" | "deny" | "require_approval" | "modify"
  },
  "enabled": true
}
```

#### Atualizar Policy
```http
PUT /policies/:id
Content-Type: application/json

{
  "enabled": false,
  "rule_expr": { ... }
}
```

#### Deletar Policy
```http
DELETE /policies/:id
```

### 🎯 Tipos de Policies

- **`global`** - Aplicável a todo o sistema
- **`tenant`** - Aplicável a um tenant específico
- **`app`** - Aplicável a um app específico
- **`tool`** - Aplicável a uma tool específica
- **`workflow`** - Aplicável a um workflow específico
- **`agent`** - Aplicável a um agent específico

### ⚙️ Efeitos

- **`allow`** - Permitir operação
- **`deny`** - Bloquear operação
- **`require_approval`** - Bloquear até aprovação humana (run fica `paused`)
- **`modify`** - Modificar metadados (ex: forçar `mode=draft`)

---

## 10. Metrics (Métricas e Observabilidade)

### 📊 Métricas

#### Obter Métricas (JSON)
```http
GET /metrics?enhanced=true&tenant_id=tenant-abc
```

**Query Params:**
- `enhanced` - `true` (padrão) para métricas aprimoradas, `false` para formato legado
- `tenant_id` - Filtrar por tenant (opcional)

**Resposta (Enhanced):**
```json
{
  "timestamp": "2024-12-19T10:00:00Z",
  "runs": {
    "total": 1000,
    "by_status": { "completed": 800, "failed": 50, "running": 10 },
    "completed_today": 42,
    "failed_today": 3,
    "paused_today": 1,
    "running_now": 5,
    "by_workflow": { "workflow-1": 500, "workflow-2": 300 },
    "by_app": { "app-1": 400, "app-2": 200 },
    "by_mode": { "draft": 600, "auto": 400 },
    "throughput_per_hour": 42.5,
    "success_rate": 0.94
  },
  "llm": {
    "calls_total": 5000,
    "calls_today": 250,
    "tokens_total": 1500000,
    "tokens_today": 75000,
    "tokens_prompt_total": 1000000,
    "tokens_completion_total": 500000,
    "cost_cents_total": 15000,
    "cost_cents_today": 750,
    "by_provider": { "openai": 3000, "anthropic": 2000 },
    "by_model": { "gpt-4o": 2000, "gpt-4o-mini": 1000, "claude-3-5-sonnet": 2000 },
    "by_agent": { "agent.triage": 2000, "agent.router": 3000 },
    "avg_latency_ms": 1200,
    "latency_p50_ms": 1000,
    "latency_p95_ms": 3500,
    "latency_p99_ms": 5000,
    "error_rate": 0.02
  },
  "tools": {
    "calls_total": 10000,
    "calls_today": 500,
    "by_tool": { "natural_language_db_read": 3000, "memory.search": 2000 },
    "by_risk_level": { "low": 7000, "medium": 2500, "high": 500 },
    "avg_duration_ms": 500,
    "error_rate": 0.01,
    "throughput_per_hour": 20.8
  },
  "policies": {
    "evaluations_total": 15000,
    "evaluations_today": 750,
    "denials_total": 50,
    "denials_today": 3,
    "approvals_total": 14950,
    "approvals_today": 747,
    "requires_approval_total": 10,
    "requires_approval_today": 1,
    "by_scope": { "global": 5000, "app": 8000, "tool": 2000 },
    "denial_rate": 0.003
  },
  "memory": {
    "items_total": 5000,
    "items_by_type": { "short_term": 2000, "long_term": 2500, "profile": 500 },
    "items_by_owner": { "user": 3000, "tenant": 1500, "app": 500 },
    "operations_today": {
      "store": 100,
      "retrieve": 200,
      "search": 300,
      "delete": 10
    }
  },
  "errors": {
    "total": 100,
    "today": 5,
    "by_type": { "TimeoutError": 30, "ValidationError": 50, "PolicyDenied": 20 },
    "by_severity": { "low": 40, "medium": 50, "high": 10 },
    "error_rate": 0.01
  },
  "performance": {
    "avg_run_duration_ms": 5000,
    "run_duration_p50_ms": 3000,
    "run_duration_p95_ms": 15000,
    "run_duration_p99_ms": 30000,
    "avg_step_duration_ms": 500,
    "step_duration_p50_ms": 300,
    "step_duration_p95_ms": 2000,
    "step_duration_p99_ms": 5000,
    "steps_per_run_avg": 5.2,
    "throughput_runs_per_hour": 42.5,
    "throughput_steps_per_hour": 250.0
  },
  "budgets": {
    "runs_with_budget": 200,
    "budget_exceeded_total": 5,
    "budget_exceeded_today": 1,
    "by_type": {
      "cost_exceeded": 2,
      "llm_calls_exceeded": 2,
      "latency_exceeded": 1
    },
    "avg_cost_per_run_cents": 15.5,
    "avg_llm_calls_per_run": 3.2
  },
  "rate_limiting": {
    "hits_total": 100000,
    "blocks_total": 50,
    "blocks_today": 2,
    "by_type": { "user": 20, "tenant": 10, "api_key": 15, "ip": 5 },
    "block_rate": 0.0005
  },
  "agents": {
    "total_agents": 10,
    "active_agents": 8,
    "calls_by_agent": { "agent.triage": 2000, "agent.router": 3000 }
  },
  "workflows": {
    "total_workflows": 50,
    "active_workflows": 30,
    "runs_by_workflow": { "workflow-1": 500, "workflow-2": 300 }
  },
  "apps": {
    "total_apps": 20,
    "active_apps": 15,
    "runs_by_app": { "app-1": 400, "app-2": 200 }
  }
}
```

#### Obter Métricas (Prometheus)
```http
GET /metrics?format=prometheus&tenant_id=tenant-abc
```

**Resposta:** Formato Prometheus
```
# HELP runs_total Total number of runs
# TYPE runs_total counter
runs_total{tenant="tenant-abc"} 1000

# HELP llm_latency_ms Average LLM call latency in milliseconds
# TYPE llm_latency_ms gauge
llm_latency_ms{percentile="p50",tenant="tenant-abc"} 1000
llm_latency_ms{percentile="p95",tenant="tenant-abc"} 3500
llm_latency_ms{percentile="p99",tenant="tenant-abc"} 5000
...
```

---

## 11. Audit (Auditoria)

### 📝 Logs (Admin/Developer)

#### Consultar Logs
```http
GET /audit/logs?user_id=user-123&resource_type=workflow&action=create&start_date=2024-12-01&end_date=2024-12-19&limit=100&offset=0
Authorization: Bearer <access_token>
```

**Query Params:**
- `user_id` - Filtrar por usuário
- `resource_type` - Filtrar por tipo (`workflow`, `tool`, `agent`, `app`, `policy`, `memory`)
- `resource_id` - Filtrar por ID do recurso
- `action` - Filtrar por ação (`create`, `update`, `delete`, `execute`)
- `tenant_id` - Filtrar por tenant
- `start_date` - Data inicial (ISO 8601)
- `end_date` - Data final (ISO 8601)
- `limit` - Limite de resultados (default: 100)
- `offset` - Offset para paginação (default: 0)

**Resposta:**
```json
{
  "logs": [
    {
      "id": "log-uuid",
      "user_id": "user-123",
      "action": "create",
      "resource_type": "workflow",
      "resource_id": "workflow-uuid",
      "changes": {
        "before": null,
        "after": { "name": "New Workflow" }
      },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-12-19T10:00:00Z"
    }
  ],
  "total": 500,
  "limit": 100,
  "offset": 0
}
```

### 📋 Eventos Auditados

- **Autenticação:** `login`, `logout`, `failed_login`
- **Recursos:** `create`, `update`, `delete` de workflows, tools, agents, apps, policies
- **Execução:** `run_start`, `run_complete`, `run_failed`
- **Memória:** `memory.stored`, `memory.deleted`

---

## 12. Alerts (Alertas)

### 🔔 Configuração (Admin/Developer)

#### Listar Configurações
```http
GET /alerts/configs?tenant_id=tenant-abc
Authorization: Bearer <access_token>
```

**Resposta:**
```json
[
  {
    "id": "alert-uuid",
    "name": "High Error Rate",
    "rule_type": "error_rate",
    "rule_config": {
      "threshold": 0.05,
      "window_minutes": 5
    },
    "channels": [
      {
        "type": "webhook",
        "config": { "url": "https://..." }
      }
    ],
    "enabled": true,
    "tenant_id": "tenant-abc"
  }
]
```

#### Criar Configuração
```http
POST /alerts/configs
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "High Error Rate",
  "rule_type": "error_rate", // "error_rate" | "budget_exceeded" | "policy_denials" | "memory_usage" | "rate_limit"
  "rule_config": {
    "threshold": 0.05,
    "window_minutes": 5
  },
  "channels": [
    {
      "type": "webhook", // "webhook" | "email" | "slack" | "pagerduty"
      "config": {
        "url": "https://hooks.slack.com/..."
      }
    }
  ],
  "enabled": true
}
```

#### Atualizar Configuração
```http
PATCH /alerts/configs/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "enabled": false
}
```

#### Deletar Configuração
```http
DELETE /alerts/configs/:id
Authorization: Bearer <access_token>
```

### ⚙️ Operações

#### Verificar Alertas Manualmente
```http
POST /alerts/check?tenant_id=tenant-abc
Authorization: Bearer <access_token>
```

#### Resolver Alerta
```http
POST /alerts/history/:id/resolve
Authorization: Bearer <access_token>
```

### 🎯 Tipos de Alertas

- **`error_rate`** - Taxa de erro alta (>threshold em window_minutes)
- **`budget_exceeded`** - Budget excedido (cost, LLM calls, latency)
- **`policy_denials`** - Muitas negações de policy
- **`memory_usage`** - Uso de memória alto
- **`rate_limit`** - Rate limit atingido

### 📨 Canais de Notificação

- **`webhook`** - POST para URL customizada
- **`email`** - Email (config requerido)
- **`slack`** - Slack webhook
- **`pagerduty`** - PagerDuty integration

---

## 13. Health & Info

### ❤️ Status

#### Info Básica
```http
GET /
```

**Resposta:**
```json
{
  "message": "LogLine LLM World API",
  "version": "1.0.0",
  "api": "/api/v1"
}
```

#### Health Check
```http
GET /healthz
```

**Resposta:**
```json
{
  "status": "ok", // "ok" | "degraded"
  "timestamp": "2024-12-19T10:00:00Z",
  "database": "connected", // "connected" | "disconnected" | "error"
  "uptime": 3600 // segundos
}
```

---

## 14. Streaming (Server-Sent Events)

### 📡 Endpoints SSE

#### Stream de Execução
```http
GET /runs/:id/stream
Accept: text/event-stream
```

**Eventos:**
- `connected` - Conexão estabelecida
- `update` - Atualização de status/eventos (a cada 500ms)
- `complete` - Execução completa
- `error` - Erro ocorreu

**Exemplo:**
```
data: {"type": "connected", "runId": "run-uuid"}

data: {"type": "update", "run": {"status": "running", "result": null}, "events": [...]}

data: {"type": "complete", "status": "completed"}
```

#### Stream de Conversação
```http
POST /agents/:id/conversation
Content-Type: application/json
Accept: text/event-stream

{
  "message": "Hello",
  "context": {...}
}
```

**Eventos:**
- `connected` - Conexão estabelecida
- `text` - Chunk de texto do agent
- `tool_call` - Tool sendo chamado
- `complete` - Conversação completa
- `error` - Erro ocorreu

**Exemplo:**
```
data: {"type": "connected", "runId": "run-uuid", "stepId": "step-uuid"}

data: {"type": "text", "content": "Hello! I can help you with..."}

data: {"type": "tool_call", "toolCall": {
  "toolId": "memory.search",
  "args": {...},
  "result": {...}
}}

data: {"type": "complete", "runId": "run-uuid", "result": "..."}
```

### 📝 Formato SSE

Cada evento é uma linha no formato:
```
data: <JSON_OBJECT>

```

Linha vazia separa eventos.

---

## 15. Headers Importantes

### 🔐 Autenticação

```
Authorization: Bearer <access_token>
```

Para API Keys:
```
Authorization: Bearer llm_xxxxxxxxxxxxx
```

### 📍 Contexto (Opcional, mas Recomendado)

```
X-User-ID: user-123
X-Tenant-ID: tenant-abc
X-Trace-ID: trace-xyz
X-App-ID: app-123
```

### ⚡ Rate Limiting (Resposta)

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 2024-12-19T10:00:00Z
```

### 📦 Content Types

**Request:**
```
Content-Type: application/json
```

**Response:**
```
Content-Type: application/json
```

**SSE:**
```
Content-Type: text/event-stream
Accept: text/event-stream
```

---

## 16. Modos de Execução

### 📝 Draft Mode

- ✅ Execução com validação completa
- ✅ Permite revisão antes de aplicar side effects
- ✅ Recomendado para desenvolvimento/testes
- ✅ Policies podem bloquear ou requerer aprovação

**Uso:**
```json
{
  "input": {...},
  "mode": "draft"
}
```

### ⚡ Auto Mode

- ✅ Execução automática
- ✅ Aplicação imediata de side effects
- ✅ Requer políticas apropriadas
- ✅ Tools de alto risco podem ser bloqueados

**Uso:**
```json
{
  "input": {...},
  "mode": "auto"
}
```

---

## 17. Budgets (Orçamentos)

### 💰 Limites por Run

Ao iniciar um run, pode incluir limites:

```json
{
  "input": {...},
  "cost_limit_cents": 1000,    // Limite de custo em centavos
  "llm_calls_limit": 50,        // Limite de chamadas LLM
  "latency_slo_ms": 30000        // SLO de latência em ms
}
```

### 🛑 Comportamento

- O backend **monitora** em tempo real
- Se exceder qualquer limite:
  - Run é marcado como `failed`
  - Evento `budget_exceeded` é criado
  - Execução é interrompida imediatamente

### 📊 Métricas de Budget

Disponíveis em `/metrics`:
- `budgets.runs_with_budget` - Runs com budget definido
- `budgets.budget_exceeded_total` - Total de excedências
- `budgets.avg_cost_per_run_cents` - Custo médio por run
- `budgets.avg_llm_calls_per_run` - Chamadas LLM médias por run

---

## 18. Error Handling

### 📋 Formato de Erro Padrão

```json
{
  "statusCode": 500,
  "errorCode": "TOOL_EXECUTION_ERROR",
  "message": "Tool execution failed for 'natural_language_db_read': Database timeout [Run: run-123, Step: step-456, Tenant: tenant-789] | Error Type: TimeoutError",
  "context": {
    "tool_id": "natural_language_db_read",
    "tool_name": "Natural Language DB Read",
    "execution_context": {
      "run_id": "run-123",
      "step_id": "step-456",
      "workflow_id": "workflow-789",
      "app_id": "app-abc",
      "tenant_id": "tenant-xyz",
      "user_id": "user-123"
    },
    "input_summary": "{query: 'SELECT * FROM users LIMIT 10'}",
    "error_details": {
      "name": "TimeoutError",
      "message": "Database connection timeout",
      "stack": "..." // apenas em development
    }
  },
  "timestamp": "2024-12-19T10:00:00Z",
  "path": "/api/v1/workflows/123/runs",
  "traceId": "trace-xyz"
}
```

### 🔒 Segurança em Erros

- ✅ **Dados sensíveis mascarados** (passwords, tokens, keys)
- ✅ **Stack traces apenas em development**
- ✅ **Input truncado** (200 caracteres)
- ✅ **Contexto completo** para debugging

### 📊 Códigos de Erro Comuns

- `BAD_REQUEST` - Requisição inválida
- `UNAUTHORIZED` - Não autenticado
- `FORBIDDEN` - Sem permissão
- `NOT_FOUND` - Recurso não encontrado
- `TOOL_EXECUTION_ERROR` - Erro na execução de tool
- `AGENT_EXECUTION_ERROR` - Erro na execução de agent
- `POLICY_DENIED` - Policy bloqueou operação
- `BUDGET_EXCEEDED` - Budget excedido
- `VALIDATION_ERROR` - Erro de validação
- `INTERNAL_SERVER_ERROR` - Erro interno

---

## 🎯 Resumo Rápido

### ✅ O que o Backend Oferece

1. **Autenticação** - JWT, API Keys, RBAC
2. **Workflows** - Criar, executar, monitorar automações
3. **Runs** - Executar workflows, stream em tempo real, retomar pausados
4. **Apps** - Importar apps, executar actions com input mapping
5. **Agents** - Conversar com agents LLM via streaming
6. **Tools** - Listar e usar tools built-in (DB, Memory, etc.)
7. **Files** - Upload, download, transferência chunked para mobile
8. **Memory** - RAG com busca semântica, armazenamento com embeddings
9. **Policies** - Governança e controle de acesso
10. **Metrics** - Observabilidade completa (percentis, throughput, etc.)
11. **Audit** - Logs de auditoria completos
12. **Alerts** - Sistema de alertas configurável
13. **Streaming** - SSE para atualizações em tempo real
14. **Budgets** - Controle de custos e limites
15. **Error Handling** - Erros verbosos e informativos

### 🚀 Pronto para

- ✅ **macOS Apps** (Swift, Electron)
- ✅ **iOS Apps** (Swift, React Native)
- ✅ **Android Apps** (Kotlin, React Native)
- ✅ **Web Apps** (React, Vue, Angular)
- ✅ **Desktop Apps** (Electron, Tauri)

---

## 📚 Documentação Adicional

- [MASTER_BLUEPRINT.md](../MASTER_BLUEPRINT.md) - Blueprint completo do sistema
- [FRONTEND_APP_GUIDELINES.md](./architecture/FRONTEND_APP_GUIDELINES.md) - Guia para frontend apps
- [APP_RUNTIME_API.md](./apps/APP_RUNTIME_API.md) - API específica de Apps
- [ENHANCED_ERROR_HANDLING.md](./implementation/ENHANCED_ERROR_HANDLING.md) - Tratamento de erros
- [ENHANCED_METRICS.md](./implementation/ENHANCED_METRICS.md) - Sistema de métricas

---

**Última Atualização:** 2024-12-19  
**Versão da API:** 1.0

