# LogLine LLM World

> A **cloud‑native LLM-first Agent OS** + **App platform** built for Vercel deployment.

[![Version](https://img.shields.io/badge/version-2.4-blue.svg)](./MASTER_BLUEPRINT.md)
[![Tests](https://img.shields.io/badge/tests-209%20passing-green.svg)](#testing)
[![Phase 4](https://img.shields.io/badge/phase-4%20complete-success.svg)](#implementation-status)

---

## 🎯 What is LogLine LLM World?

LogLine LLM World is a **production-ready platform** for building and orchestrating LLM-powered agents and workflows. It provides a complete infrastructure for creating multiple applications on top of a shared "brain" - enabling you to ship products faster while maintaining full observability and control.

### Core Capabilities

- **🤖 LLM-First Agent OS**: Agents make intelligent decisions for routing, conditionals, and tool selection
- **🔄 Workflow Engine**: Graph-based workflows with LLM-powered nodes (agents, tools, routers)
- **🛠️ Tool System**: Extensible tool registry with natural language database operations
- **📱 App Platform**: Build multiple apps on top of a shared agent infrastructure
- **🔍 Full Traceability**: Complete audit trail of every action, tool call, and LLM interaction
- **🔐 Enterprise Safety**: Auth & RBAC, audit logging, policy enforcement, rate limiting, alerts
- **🧠 Memory Engine**: RAG-enabled memory storage with semantic search (pgvector)
- **📊 Observability**: Comprehensive metrics, monitoring, and alerting

---

## ✨ Key Features

### LLM-First Design
- **Intelligent Routing**: Router nodes use LLM agents to make routing decisions
- **Natural Language Conditions**: Conditional edges evaluated by LLM agents
- **Dynamic Tool Selection**: Agents select and call tools via LLM reasoning
- **Structured Context**: JSON✯Atomic format for better LLM understanding
- **Natural Language Structuring**: TDLN-T pre-processes natural language into structured format

### Enterprise-Ready
- **Authentication & RBAC**: JWT-based auth with role-based access control (admin, developer, user)
- **Policy Engine**: Rule-based policy enforcement for tool calls, run starts, and modes
- **Audit Logging**: Complete audit trail of all critical actions
- **Rate Limiting**: Per-user, per-tenant, per-API-key, and per-IP limits
- **Metrics & Monitoring**: Comprehensive metrics in JSON and Prometheus formats
- **Alerts System**: 5 rule types with 4 notification channels (webhook, email, slack, pagerduty)
- **Budget Tracking**: Cost, LLM calls, and latency limits per run

### Developer Experience
- **App Manifests**: Define apps as JSON/YAML manifests (no code required)
- **Natural Language DB**: Read/write database operations via natural language
- **Streaming Support**: Server-Sent Events (SSE) for real-time updates
- **Full API**: RESTful API with comprehensive endpoints
- **Type Safety**: Full TypeScript with type-safe DTOs and schemas

---

## 🏗️ Architecture

### Three Planes Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Experience Plane                      │
│  App Runtime API | Run/Trace API | Streaming (SSE)      │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                     Control Plane                       │
│  Workflows | Tools | Agents | Apps | Policies | Memory │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                    Execution Plane                      │
│  Orchestrator | Agent Runtime | Tool Runtime | LLM Router│
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Backend**: NestJS (TypeScript) with TypeORM
- **Database**: Vercel Postgres (with pgvector for RAG)
- **Deployment**: Vercel Serverless Functions
- **LLM Integration**: Vercel AI SDK v5 (OpenAI, Anthropic, Google)
- **Authentication**: JWT with Passport
- **Validation**: Zod, class-validator
- **Testing**: Jest with comprehensive test coverage

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Vercel account (for deployment)
- PostgreSQL (Vercel Postgres recommended)

### Local Development

```bash
# Clone repository
git clone https://github.com/danvoulez/LogLine-LLM-World-New.git
cd LogLine-LLM-World-New

# Install dependencies
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start local Postgres (optional, or use Vercel Postgres)
docker-compose up -d postgres

# Run migrations (auto-sync in dev)
npm run start:dev

# Run tests
npm run test
npm run test:e2e
```

### Environment Variables

Create `backend/.env`:

```env
# Database
POSTGRES_URL=postgresql://user:password@host:port/database
# OR individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=logline

# GitHub App (Optional - for github_api tool)
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_INSTALLATION_ID=12345678

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_GENERATIVE_AI_API_KEY=...

# JWT (for authentication)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Application
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

See [docs/guides/ENV_VARIABLES.md](./docs/guides/ENV_VARIABLES.md) for complete reference.

---

## 📚 Documentation

### Core Documentation
- **[docs/MASTER_BLUEPRINT.md](./docs/MASTER_BLUEPRINT.md)** - Complete system specification (v2.6)
- **[docs/CODEBASE_REVIEW.md](./docs/CODEBASE_REVIEW.md)** - Codebase review and principles verification
- **[docs/DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md)** - Complete documentation index
- **[docs/README.md](./docs/README.md)** - Documentation overview

### Quick Links
- **[docs/guides/](./docs/guides/)** - Developer guides (AI SDK, Environment Variables, Deployment)
- **[docs/phases/](./docs/phases/)** - Phase implementation documentation
- **[docs/testing/](./docs/testing/)** - Testing documentation
- **[docs/architecture/](./docs/architecture/)** - Architecture documentation
- **[docs/design/](./docs/design/)** - Design principles and philosophy

---

## 🎯 Implementation Status

### ✅ Completed Phases

- **Phase 1**: Platform foundation (workflows, runs, steps, events)
- **Phase 1.5**: Serverless optimizations (async execution, streaming, security)
- **Phase 2**: Agents, tools & LLM integration (complete)
- **Phase 2.5**: Error handling & testing improvements
- **Phase 3**: App platform & developer surface (complete)
- **Phase 4**: Memory engine, Policy Engine v1, Auth & RBAC, Audit, Metrics, Alerts, Rate Limiting (complete)

### 📊 Current Status

- **166 TypeScript files**
- **36 test files** (209 tests, all passing)
- **11 database migrations**
- **Production-ready** with enterprise hardening

---

## 🔌 API Overview

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/api-keys` - Create API key

### Workflows
- `POST /workflows` - Create workflow
- `GET /workflows` - List workflows
- `GET /workflows/:id` - Get workflow
- `POST /workflows/:id/runs` - Start workflow run

### Runs
- `GET /runs/:id` - Get run details
- `GET /runs/:id/events` - Get run events/trace
- `GET /runs/:id/stream` - Stream run updates (SSE)

### Apps
- `POST /apps/import` - Import app manifest
- `GET /apps` - List apps
- `POST /apps/:app_id/actions/:action_id` - Execute app action

### Tools & Agents
- `GET /tools` - List tools
- `GET /agents` - List agents
- `POST /agents/:id/test` - Test agent

### Policies (Phase 4)
- `GET /api/v1/policies` - List policies
- `POST /api/v1/policies` - Create policy
- `PATCH /api/v1/policies/:id` - Update policy

### Metrics & Monitoring (Phase 4)
- `GET /api/v1/metrics` - Get metrics (JSON or Prometheus)
- `GET /api/v1/audit/logs` - Query audit logs
- `GET /api/v1/alerts/configs` - List alert configurations

See [MASTER_BLUEPRINT.md](./MASTER_BLUEPRINT.md) for complete API reference.

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e

# Run specific test suite
npm run test -- --testPathPatterns="auth"
```

**Test Coverage:**
- ✅ 209 tests total
- ✅ 36 test files
- ✅ All tests passing
- ✅ Unit tests for all critical services
- ✅ Integration tests for key workflows

---

## 🚀 Deployment

### Vercel Deployment

1. **Create Vercel Postgres Database**
   - Vercel Dashboard → Storage → Create Database → Postgres
   - `POSTGRES_URL` is automatically set

2. **Deploy Backend**
   ```bash
   cd backend
   vercel --prod
   ```

3. **Set Environment Variables**
   - Add `OPENAI_API_KEY` (or other LLM provider keys)
   - Add `JWT_SECRET` and `JWT_REFRESH_SECRET`
   - `POSTGRES_URL` is automatically available

4. **Enable pgvector Extension**
   ```bash
   # Run migration or use Vercel SQL editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

See [docs/guides/VERCEL_DEPLOYMENT.md](./docs/guides/VERCEL_DEPLOYMENT.md) for detailed instructions.

---

## 🎨 Example: Creating an App

### 1. Define App Manifest

```json
{
  "version": "1.0.0",
  "app": {
    "id": "guest_support_console",
    "name": "Guest Support Console",
    "scopes": {
      "tools": ["natural_language_db_read", "natural_language_db_write"]
    },
    "workflows": [
      {
        "id": "ticket_flow",
        "workflow_ref": "demo_tickets_v1",
        "label": "Ticket triage flow"
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

### 2. Import App

```bash
curl -X POST https://your-api.vercel.app/apps/import \
  -H "Content-Type: application/json" \
  -d @app-manifest.json
```

### 3. Execute App Action

```bash
curl -X POST https://your-api.vercel.app/apps/guest_support_console/actions/triage_ticket \
  -H "Content-Type: application/json" \
  -d '{
    "event": { "hotel_id": "VV-LISBON" },
    "context": { "user_id": "user:dan", "tenant_id": "tenant:voulezvous" }
  }'
```

---

## 🏛️ Project Structure

```
.
├── backend/              # NestJS backend API
│   ├── src/
│   │   ├── workflows/   # Workflow management
│   │   ├── runs/        # Run execution & events
│   │   ├── execution/   # Orchestrator service
│   │   ├── agents/      # Agent runtime & context
│   │   ├── tools/       # Tool registry & runtime
│   │   ├── apps/        # App platform
│   │   ├── policies/    # Policy engine
│   │   ├── memory/      # Memory/RAG engine
│   │   ├── auth/        # Authentication & RBAC
│   │   ├── audit/       # Audit logging
│   │   ├── metrics/     # Metrics & monitoring
│   │   ├── alerts/      # Alerts system
│   │   └── ...
│   ├── api/             # Vercel serverless handler
│   └── examples/        # Example app manifests
├── docs/                # Documentation
│   ├── phases/          # Phase implementation docs
│   ├── testing/         # Testing documentation
│   ├── guides/          # Developer guides
│   ├── architecture/   # Architecture docs
│   ├── design/          # Design principles
│   └── ...
├── MASTER_BLUEPRINT.md  # Complete system specification (v2.4)
├── CODEBASE_REVIEW.md   # Codebase review and principles
└── README.md            # This file
```

---

## 🎓 Key Concepts

### Workflow
A graph of nodes and edges that describes *how* a task should be executed. Nodes can be:
- **Static nodes**: Simple data transformations
- **Tool nodes**: Direct tool calls
- **Agent nodes**: LLM-powered agents that can call tools
- **Router nodes**: LLM-powered routing decisions

### Run
A single execution of a workflow with input, mode, user, tenant, and app context.

### Agent
An LLM-powered entity that makes decisions, calls tools, and reasons about context. Agents use structured context (JSON✯Atomic) for better understanding.

### Tool
A capability that can be called by agents or directly by workflows. Tools include:
- Natural language database operations (read/write)
- Memory operations (store, retrieve, search)
- Custom tools (extensible)

### App
A bundle of workflows, tools, and UI that runs on top of the platform. Apps are defined via manifests (JSON/YAML).

### Policy
Rules that control what can be executed, by whom, and under what conditions. Policies enforce security and governance.

---

## 🔒 Security & Governance

- **Authentication**: JWT-based with refresh tokens
- **RBAC**: Role-based access control (admin, developer, user)
- **Policy Engine**: Rule-based enforcement for tool calls and run starts
- **Audit Logging**: Complete audit trail of all actions
- **Rate Limiting**: Multi-level rate limiting (user, tenant, API key, IP)
- **Input Validation**: Comprehensive validation with Zod and class-validator
- **SQL Security**: READ ONLY transactions for read operations, validation for writes

---

## 📈 Metrics & Observability

- **Metrics Endpoint**: `/api/v1/metrics` (JSON or Prometheus format)
- **Audit Logs**: Queryable audit trail via `/api/v1/audit/logs`
- **Alerts**: Configurable alerts with multiple notification channels
- **Event Logging**: Complete trace of every run, step, tool call, and LLM interaction

---

## 🤝 Contributing

This is a private project. For questions or contributions, please contact the maintainers.

---

## 📄 License

UNLICENSED

---

## 🔗 Links

- **Blueprint**: [docs/MASTER_BLUEPRINT.md](./docs/MASTER_BLUEPRINT.md)
- **Codebase Review**: [docs/CODEBASE_REVIEW.md](./docs/CODEBASE_REVIEW.md)
- **Documentation Index**: [docs/DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md)
- **API Reference**: See [docs/API_MENU.md](./docs/API_MENU.md)

---

**Built with ❤️ for LLM-first agent orchestration**
