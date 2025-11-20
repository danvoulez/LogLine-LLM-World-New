# LogLine Backend - Phase 1

Backend API for LogLine LLM Agent OS - Phase 1 implementation providing workflow execution and run tracking.

## Features

- **Workflow Management**: CRUD operations for workflows with graph-based definitions
- **Run Execution**: Start and track workflow executions with full event logging
- **Execution Ledger**: Complete trace of runs, steps, and events for debugging and analytics

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Docker and Docker Compose (optional, for local database)

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=logline

# Application
PORT=3000
NODE_ENV=development
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start PostgreSQL Database

Using Docker Compose (from project root):

```bash
docker-compose up -d postgres
```

Or use your own PostgreSQL instance and update the `.env` file accordingly.

### 3. Run the Application

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`

## Database

TypeORM is configured to automatically synchronize the database schema in development mode. In production, you should use migrations instead.

The following entities are created:
- `workflows` - Workflow definitions
- `runs` - Workflow execution instances
- `steps` - Individual step executions within a run
- `events` - Event log for runs and steps

## API Endpoints

### Workflows

- `POST /workflows` - Create a new workflow
- `GET /workflows` - List workflows (with pagination: `?page=1&limit=10`)
- `GET /workflows/:id` - Get workflow details
- `PATCH /workflows/:id` - Update a workflow
- `DELETE /workflows/:id` - Delete a workflow

### Runs

- `POST /workflows/:id/runs` - Start a new workflow run (returns immediately, executes asynchronously)
- `GET /runs/:id` - Get run details (poll for status updates)
- `GET /runs/:id/events` - Get all events for a run
- `GET /runs/:id/stream` - Stream run updates via Server-Sent Events (SSE) for real-time monitoring

## Example Usage

### 1. Create a Workflow

```bash
curl -X POST http://localhost:3000/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple Test Workflow",
    "definition": {
      "nodes": [
        {
          "id": "node1",
          "type": "static",
          "output": { "message": "Hello from workflow" }
        }
      ],
      "edges": [],
      "entryNode": "node1"
    },
    "type": "linear"
  }'
```

### 2. Start a Run (Async)

```bash
curl -X POST http://localhost:3000/workflows/{workflow-id}/runs \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "test": "data" },
    "mode": "draft"
  }'
```

**Note**: This returns immediately with a `run_id`. The workflow executes in the background. Check status by polling `GET /runs/:id` or use the streaming endpoint.

### 3. Get Run Details (Poll for Status)

```bash
curl http://localhost:3000/runs/{run-id}
```

Response includes `status` field: `pending`, `running`, `completed`, or `failed`.

### 4. Stream Run Updates (Real-time)

```bash
curl -N http://localhost:3000/runs/{run-id}/stream
```

This opens a Server-Sent Events (SSE) connection that streams real-time updates:
- `connected` - Initial connection
- `update` - Status and event updates (every 500ms)
- `complete` - Workflow finished
- `error` - Error occurred

### 5. Get Run Events

```bash
curl http://localhost:3000/runs/{run-id}/events
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

### Vercel (Recommended)

This application is configured for easy deployment to Vercel with serverless Postgres:

1. **Create Vercel Postgres Database**
   - Go to Vercel Dashboard → Storage → Create Database → Postgres
   - The `POSTGRES_URL` environment variable is automatically set

2. **Deploy**
   ```bash
   cd backend
   vercel --prod
   ```
   Or connect your GitHub repository in the Vercel dashboard

3. **That's it!** The app automatically uses Vercel Postgres via `POSTGRES_URL`

For detailed deployment instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

### Other Platforms

The application can also be deployed to:
- Railway
- Render
- Fly.io
- AWS/GCP/Azure
- Any platform supporting Node.js and PostgreSQL

Ensure you set the appropriate database environment variables.

## Project Structure

```
src/
├── workflows/          # Workflow management module
│   ├── dto/            # Data transfer objects
│   ├── entities/       # TypeORM entities
│   ├── workflows.controller.ts
│   ├── workflows.service.ts
│   └── workflows.module.ts
├── runs/               # Run execution module
│   ├── dto/            # Data transfer objects
│   ├── entities/       # Run, Step, Event entities
│   ├── runs.controller.ts
│   ├── runs.service.ts
│   └── runs.module.ts
├── execution/          # Execution engine
│   └── orchestrator.service.ts
├── app.module.ts       # Root module
└── main.ts            # Application entry point
```

## Phase 1 Status

✅ Database schema with Workflow, Run, Step, and Event entities
✅ Workflow CRUD API with validation
✅ Run execution endpoints (async execution)
✅ Streaming endpoints (Server-Sent Events) for real-time monitoring
✅ Basic orchestrator for linear workflows
✅ Event logging and trace retrieval
✅ Unit and E2E tests

## Phase 1.5: Serverless Optimizations

✅ **Async Workflow Execution**: Workflows execute in background, API returns immediately (prevents Vercel timeout issues)
✅ **Streaming Support**: Real-time updates via Server-Sent Events (SSE) for long-running workflows
✅ **Security**: Natural language DB tools include dry-run mode and SQL validation (documented in Phase 2 plan)

See [CRITICAL_VERCEL_CONSIDERATIONS.md](../CRITICAL_VERCEL_CONSIDERATIONS.md) and [PHASE1.5_SERVERLESS_OPTIMIZATIONS.md](../PHASE1.5_SERVERLESS_OPTIMIZATIONS.md) for details.

## Next Steps (Phase 2)

- Agent runtime with LLM integration
- Tool runtime and registry
- Policy engine
- Enhanced workflow node types (agent, tool, router, human_gate)

### Phase 2: AI SDK Integration

We're planning to use [Vercel AI SDK v5](https://v5.ai-sdk.dev/) for Phase 2 implementation:

- **LLM Router**: Unified API for OpenAI, Anthropic, Google providers
- **Agent Runtime**: Tool calling, streaming, structured outputs
- **Natural Language SQL**: Query database using natural language (read & write) (inspired by [Vercel's template](https://vercel.com/templates/next.js/natural-language-postgres))

See [PHASE2_AI_SDK_INTEGRATION.md](../PHASE2_AI_SDK_INTEGRATION.md) for detailed integration plan and [AI_SDK_QUICK_START.md](./AI_SDK_QUICK_START.md) for quick reference.

### Phase 4: RAG Memory Engine

For Phase 4, we'll implement the Memory Engine with RAG capabilities using the [AI SDK RAG Agent guide](https://ai-sdk.dev/llms.txt):

- **Memory Storage**: Postgres + pgvector for semantic search
- **Embedding Service**: AI SDK embeddings for automatic vector generation
- **RAG Tools**: Memory tools for agents to store/retrieve context
- **Knowledge Base**: Chunked resources for RAG workflows

See [PHASE4_RAG_MEMORY_INTEGRATION.md](../PHASE4_RAG_MEMORY_INTEGRATION.md) for the complete RAG implementation plan.

## License

UNLICENSED
