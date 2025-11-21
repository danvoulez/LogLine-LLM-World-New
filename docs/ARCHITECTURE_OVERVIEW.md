# LogLine LLM World - Architecture Overview

> **High-level system architecture and component relationships**

## 🏗️ System Architecture

### Hybrid Deployment Model

```
┌─────────────────────────────────────────────────────────┐
│                    LogLine LLM World                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │   Vercel (Brain) │         │ Railway (Muscle) │    │
│  │   Serverless     │◄────────┤ Containerized     │    │
│  │   Backend API    │  HMAC   │ Executor Service │    │
│  └──────────────────┘         └──────────────────┘    │
│         │                                               │
│         │                                               │
│  ┌──────▼──────────────────────────────────────┐       │
│  │         Frontend (Next.js PWA)              │       │
│  │         - Atomic Rendering Engine           │       │
│  │         - OmniBar (Floating Input)         │       │
│  │         - Visual Cortex Integration        │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🧩 Core Components

### 1. Backend (Vercel Serverless)

**Location:** `backend/`

**Technology Stack:**
- NestJS (Framework)
- TypeORM (ORM)
- PostgreSQL with pgvector (Database)
- Vercel AI SDK (LLM Integration)

**Key Services:**
- **Registry Services:** People, Objects, Ideas, Contracts, Agents, Relationships
- **Agent Runtime:** LLM-powered agent execution
- **Tool Runtime:** Tool execution with policy enforcement
- **Policy Engine V1:** Governance and access control
- **Memory Service:** RAG and vector search
- **LlmRouterService:** Centralized LLM calls
- **Visual Cortex:** JSON✯Atomic layout generation

**API Endpoints:**
- `/api/v1/render` - Visual Cortex layout generation
- `/api/v1/registry/*` - Registry operations
- `/api/v1/agents/*` - Agent management
- `/api/v1/tools/*` - Tool execution

### 2. Frontend (Next.js PWA)

**Location:** `logline-ui/`

**Technology Stack:**
- Next.js 16 (App Router)
- Tailwind CSS
- Framer Motion (Animations)
- Lucide Icons

**Key Components:**
- **OmniBar:** Floating input bar (bottom of screen)
- **AtomicRenderer:** Renders JSON✯Atomic layouts
- **Safe Components:** Card, Metric, Table, Chart, Badge, TraceRibbon
- **Service Worker:** PWA offline support

**Features:**
- PWA support for iPhone 16
- Dynamic layout generation from backend
- Real-time data binding
- Offline support

### 3. Executor (Railway Container)

**Location:** `executor/`

**Technology Stack:**
- Express.js
- Puppeteer (Web browsing)
- Node.js child_process (Code execution)

**Key Features:**
- HMAC-SHA256 authentication
- Code interpreter (JavaScript, Python)
- Web browser (Puppeteer)
- Health checks and graceful shutdown

**Communication:**
- Secure HMAC-signed requests from Vercel backend
- Replay attack prevention (timestamp validation)

## 🔄 Data Flow

### Visual Cortex Flow

```
User Prompt (Natural Language)
    ↓
Frontend OmniBar
    ↓
POST /api/v1/render
    ↓
Backend AppController
    ↓
parseIntentToAtomic()
    → action: "list" | "debug" | "analyze"
    → entity: "contract" | "agent" | etc.
    ↓
fetchDataPreview()
    → Queries Registry Services
    → Returns real data samples
    ↓
Build JSON✯Atomic Input
    → atomic_type: "intent_vector"
    → vector: { action, entity, filters }
    → context: { role, vibe }
    → data_preview: { count, sample, meta }
    ↓
LLM (Visual Cortex)
    → Receives structured data
    → Generates JSON layout blueprint
    → Temperature 0.2 (deterministic)
    ↓
Frontend AtomicRenderer
    → Maps JSON to Safe Components
    → Renders with animations
```

### Agent Execution Flow

```
Agent Run Request
    ↓
AgentRuntimeService
    ↓
Policy Engine Check
    → Validates contract scope
    → Checks budget limits
    → Enforces tool restrictions
    ↓
LLM Call (via LlmRouterService)
    → Generates next step
    → Selects tools
    ↓
Tool Execution
    → Local tools (Registry, Memory, etc.)
    → Remote tools (Executor via HMAC)
    ↓
Event Logging
    → Saves to database
    → Emits events
```

## 🗄️ Database Schema

### Core Tables
- `users` - Authentication
- `agents` - Agent definitions
- `tools` - Tool definitions
- `runs` - Agent execution runs
- `events` - Execution events

### Registry Tables
- `core_people` - Universal person identities
- `registry_objects` - Trackable objects
- `registry_ideas` - Ideas and voting
- `registry_contracts` - Executable contracts
- `registry_relationships` - Generic relationships
- `agents` (extended) - Agent Registry data

### Memory & RAG
- `memory_items` - Agent memory
- `resources` - RAG resources
- Vector embeddings (pgvector)

## 🔐 Security Architecture

### Multi-Tenant Isolation
- Tenant-scoped data access
- Ownership validation
- Policy-based access control

### Authentication
- JWT-based authentication
- API key support
- Session management

### Policy Engine
- Fail-closed by default
- Contract scope enforcement
- Budget and tool restrictions

## 📡 Communication Patterns

### Backend ↔ Executor
- HMAC-SHA256 signatures
- Timestamp validation
- Circuit breaker pattern
- Timeout protection (5 minutes)

### Frontend ↔ Backend
- REST API
- CORS enabled
- JSON✯Atomic format
- Graceful fallback to mock data

## 🚀 Deployment Architecture

### Vercel (Backend)
- Serverless functions
- Auto-scaling
- Edge network
- Vercel Postgres (Neon)

### Railway (Executor)
- Containerized service
- Persistent connections
- Resource-intensive operations
- Health monitoring

### Frontend
- Static generation (Next.js)
- PWA capabilities
- Service Worker caching
- Offline support

## 📊 Observability

### Logging
- Structured logging
- Event emission
- Execution traces

### Metrics
- Agent performance
- Cost tracking
- Tool usage
- Policy evaluations

### Health Checks
- Backend: `/api/v1/healthz`
- Executor: `/health`
- Database connectivity
- Resource monitoring

---

**For detailed specifications, see:**
- [Master Blueprint](./MASTER_BLUEPRINT.md)
- [API Reference](./API_MENU.md)
- [Architecture Docs](./architecture/)

