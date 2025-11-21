# 🍽️ Menu do Backend - O que um Frontend-App pode usar

**Versão:** 1.1  
**Data:** 2025-11-21  
**Base URL:** `/api/v1`

---

## 📋 Índice

1. [Autenticação e Usuários](#1-autenticação-e-usuários)
2. [Registry (Universal)](#2-registry-universal)
3. [Workflows (Automações)](#3-workflows-automações)
4. [Runs (Execuções)](#4-runs-execuções)
5. [Apps (Aplicações)](#5-apps-aplicações)
6. [Agents (Agentes LLM)](#6-agents-agentes-llm)
7. [Tools (Ferramentas)](#7-tools-ferramentas)
8. [Files (Arquivos)](#8-files-arquivos)
9. [Memory (Memória RAG)](#9-memory-memória-rag)
10. [Policies (Políticas de Governança)](#10-policies-políticas-de-governança)
11. [Metrics (Métricas e Observabilidade)](#11-metrics-métricas-e-observabilidade)
12. [Audit (Auditoria)](#12-audit-auditoria)
13. [Alerts (Alertas)](#13-alerts-alertas)
14. [Health & Info](#14-health--info)
15. [Streaming (Server-Sent Events)](#15-streaming-server-sent-events)
16. [Headers Importantes](#16-headers-importantes)
17. [Modos de Execução](#17-modos-de-execução)
18. [Budgets (Orçamentos)](#18-budgets-orçamentos)
19. [Error Handling](#19-error-handling)

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
  "cpf": "123.456.789-00", // Obrigatório para Registry
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
    "logline_id": "LL-BR-2025-000000001-CS", // Identidade Universal
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

#### Renovar Access Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "jwt_refresh_token"
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
  "expires_at": "2025-12-31T23:59:59Z"
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

## 2. Registry (Universal)

O Registry é o repositório central de identidades e contratos.

### 👤 Pessoas (People)

#### Buscar Pessoa
```http
GET /registry/people?cpf=123...&email=user@example.com
```

#### Obter Pessoa por LogLine ID
```http
GET /registry/people/:loglineId
```

#### Vincular a Tenant
```http
POST /registry/people/:loglineId/link-tenant
Content-Type: application/json

{
  "tenant_id": "tenant-uuid",
  "role": "customer", // "vendor", "employee", "admin"
  "data": { "custom_field": "value" }
}
```

### 📦 Objetos (Objects)

#### Criar Objeto
```http
POST /registry/objects
Content-Type: application/json

{
  "object_type": "merchandise", // "document", "file", "service", etc.
  "name": "Laptop Pro",
  "identifier": "SKU-12345",
  "owner_logline_id": "LL-BR-...",
  "tenant_id": "tenant-uuid"
}
```

#### Transferir Objeto
```http
PUT /registry/objects/:id/transfer
Content-Type: application/json

{
  "to_logline_id": "LL-BR-...",
  "to_location": "Warehouse B",
  "reason": "Sales order #123"
}
```

#### Listar Objetos
```http
GET /registry/objects?tenant_id=...&q=laptop
```

### 💡 Ideias (Ideas)

#### Submeter Ideia
```http
POST /registry/ideas
Content-Type: application/json

{
  "titulo": "Automação de Notas Fiscais",
  "descricao": "Usar IA para ler PDFs...",
  "prioridade_autor": 8,
  "custo_estimado_cents": 50000,
  "tenant_id": "tenant-uuid",
  "autor_logline_id": "LL-BR-..."
}
```

#### Votar em Ideia
```http
POST /registry/ideas/:id/vote
Content-Type: application/json

{
  "voter_logline_id": "LL-BR-...",
  "prioridade": 9,
  "comentario": "Essencial para Q1"
}
```

#### Matriz Custo x Prioridade
```http
GET /registry/ideas/matrix/:tenantId
```

### 📜 Contratos (Contracts)

#### Criar Contrato
```http
POST /registry/contracts
Content-Type: application/json

{
  "titulo": "Desenvolvimento App Mobile",
  "tipo": "prestacao_servico",
  "autor_logline_id": "LL-BR-...",
  "contraparte_logline_id": "LL-AGENT-...",
  "valor_total_cents": 1500000,
  "escopo": ["ios_app", "android_app"],
  "tenant_id": "tenant-uuid"
}
```

#### Assinar (Ativar) Contrato
```http
POST /registry/contracts/:id/sign
Content-Type: application/json

{
  "signed_by_logline_id": "LL-BR-..."
}
```

#### Templates de Contrato
```http
GET /registry/contracts/templates
POST /registry/contracts/templates/:id/create
```

### 🤖 Agentes no Registry

#### Registrar Agente
```http
POST /registry/agents
Content-Type: application/json

{
  "id": "agent.coder",
  "name": "Senior Coder",
  "instructions": "You are an expert...",
  "allowed_tools": ["github_api", "code_interpreter"],
  "owner_logline_id": "LL-BR-..."
}
```

#### Atribuir Contrato a Agente
```http
POST /registry/agents/:id/contract
Content-Type: application/json

{
  "contract_id": "contract-uuid",
  "contract_scope": {
    "max_cost_per_run_cents": 500,
    "allowed_tools": ["github_api"]
  }
}
```

#### Logs de Execução
```http
GET /registry/agents/:id/execution-logs
GET /registry/agents/:id/execution-stats
```

---

## 3. Workflows (Automações)

### 📋 Gerenciamento

#### Listar Workflows
```http
GET /workflows?page=1&limit=10
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
  "definition": { ... }
}
```

### ▶️ Execução

#### Iniciar Execução
```http
POST /workflows/:id/runs
Content-Type: application/json

{
  "input": { "hotel_id": "VV-LISBON" },
  "mode": "draft",
  "tenant_id": "tenant-abc"
}
```

---

## 4. Runs (Execuções)

### 📊 Consulta

#### Obter Detalhes
```http
GET /runs/:id
```

#### Obter Eventos/Trace
```http
GET /runs/:id/events
```

#### Stream em Tempo Real (SSE)
```http
GET /runs/:id/stream
Accept: text/event-stream
```

### ⏯️ Controle

#### Retomar Execução Pausada
```http
PATCH /runs/:id/resume
Content-Type: application/json

{
  "approval_input": { "approved": true }
}
```

---

## 5. Apps (Aplicações)

### 📦 Gerenciamento

#### Listar Apps
```http
GET /apps
```

#### Obter App
```http
GET /apps/:app_id
```

#### Importar App Manifest
```http
POST /apps/import
Content-Type: application/json

{
  "app": { ... },
  "scopes": [...],
  "workflows": [...],
  "actions": [...]
}
```

### ▶️ Execução de Actions

#### Executar Action
```http
POST /apps/:app_id/actions/:action_id
Content-Type: application/json

{
  "event": { ... },
  "context": { ... }
}
```

---

## 6. Agents (Agentes LLM)

### 🤖 Gerenciamento

#### Listar Agents
```http
GET /agents
```

#### Obter Agent
```http
GET /agents/:id
```

### 💬 Conversação (Streaming)

#### Conversar com Agent
```http
POST /agents/:id/conversation
Content-Type: application/json
Accept: text/event-stream

{
  "message": "Hello",
  "context": { ... }
}
```

---

## 7. Tools (Ferramentas)

### 🔧 Consulta

#### Listar Tools
```http
GET /tools
```

### 🛠️ Tools Built-in

- **`natural_language_db_read`**: Consultas SQL seguras via linguagem natural.
- **`natural_language_db_write`**: Operações de escrita controladas.
- **`memory.*`**: Operações de memória RAG.
- **`registry.*`**: Operações no Registry (buscar pessoas, contratos).
- **`http_request`**: Requisições HTTP genéricas.
- **`github_api`**: Interação com GitHub.
- **`code_interpreter`**: Execução de código Python/JS (via Executor).
- **`web_browser`**: Navegação web e scraping (via Executor).

---

## 8. Files (Arquivos)

### 📁 Gerenciamento

#### Upload Arquivo
```http
POST /files
Content-Type: application/json

{
  "path": "docs/report.pdf",
  "content": "base64..."
}
```

#### Download Arquivo
```http
GET /files/:id
```

#### Transferência Chunked (Mobile)
```http
GET /files/:id/chunks?chunk=0&size=65536
```

---

## 9. Memory (Memória RAG)

### 🧠 Operações

Operações via tools `memory.store`, `memory.retrieve`, `memory.search`.

Exemplo Search:
```json
{
  "query": "resumo da reunião passada",
  "owner_id": "user-123",
  "type": "long_term",
  "threshold": 0.75
}
```

---

## 10. Policies (Políticas de Governança)

### 📜 Gerenciamento

#### Listar Policies
```http
GET /policies?scope=app
```

#### Criar Policy
```http
POST /policies
Content-Type: application/json

{
  "name": "Require Approval for High Cost",
  "rule_expr": {
    "condition": { "cost_cents": { "$gt": 5000 } },
    "effect": "require_approval"
  },
  "enabled": true
}
```

---

## 11. Metrics (Métricas e Observabilidade)

### 📊 Métricas

#### Obter JSON
```http
GET /metrics?enhanced=true
```

#### Obter Prometheus
```http
GET /metrics?format=prometheus
```

---

## 12. Audit (Auditoria)

### 📝 Logs

#### Consultar Logs
```http
GET /audit/logs?resource_type=contract&action=sign
```

---

## 13. Alerts (Alertas)

### 🔔 Gerenciamento

#### Listar Configurações
```http
GET /alerts/configs
```

#### Criar Alerta
```http
POST /alerts/configs
Content-Type: application/json

{
  "rule_type": "budget_exceeded",
  "channels": [{ "type": "email", "config": { "email": "admin@example.com" } }]
}
```

---

## 14. Health & Info

#### Health Check
```http
GET /healthz
```

---

## 15. Streaming (Server-Sent Events)

#### Stream de Execução
```http
GET /runs/:id/stream
```

#### Stream de Conversação
```http
POST /agents/:id/conversation
```

---

## 16. Headers Importantes

- `Authorization: Bearer <token>`
- `X-User-ID`, `X-Tenant-ID` (Contexto)
- `X-RateLimit-*` (Rate Limiting)

---

## 17. Modos de Execução

- **`draft`**: Execução segura, sem efeitos colaterais permanentes (quando possível), permite revisão.
- **`auto`**: Execução completa e autônoma.

---

## 18. Budgets (Orçamentos)

Definidos por Run ou Contrato:
- `cost_limit_cents`
- `llm_calls_limit`
- `latency_slo_ms`

---

## 19. Error Handling

Respostas de erro padronizadas:
```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_ERROR",
  "message": "Invalid CPF format",
  "context": { ... }
}
```
