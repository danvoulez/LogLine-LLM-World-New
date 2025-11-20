# LogLine LLM World

> A **cloud‑native LLM-first Agent OS** + **App platform** built for Vercel deployment.

## Overview

LogLine LLM World is a platform for building and orchestrating LLM-powered agents and workflows. It provides:

- **Workflow Engine**: Define and execute graph-based workflows with LLM agents
- **Tool System**: Extensible tool registry with natural language database operations
- **App Platform**: Build multiple apps on top of a shared agent infrastructure
- **Full Traceability**: Complete audit trail of every action, tool call, and LLM interaction

## Architecture

- **Backend**: NestJS (TypeScript) with TypeORM
- **Database**: Vercel Postgres (with pgvector for RAG)
- **Deployment**: Vercel Serverless Functions
- **LLM Integration**: Vercel AI SDK v5 (OpenAI, Anthropic, Google)
- **Frontend**: (Coming in Phase 3)

## Project Structure

```
.
├── backend/              # NestJS backend API
│   ├── src/
│   │   ├── workflows/   # Workflow management
│   │   ├── runs/        # Run execution & events
│   │   └── execution/   # Orchestrator service
│   └── api/             # Vercel serverless handler
├── MASTER_BLUEPRINT.md  # Complete system specification
└── README.md            # This file
```

## Quick Start

### Prerequisites

- Node.js 18+
- Vercel account
- PostgreSQL (Vercel Postgres recommended)

### Local Development

```bash
# Install dependencies
cd backend
npm install

# Start local Postgres (or use Vercel Postgres)
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
# Database (use POSTGRES_URL for Vercel Postgres)
POSTGRES_URL=postgresql://user:password@host:port/database
# OR individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=logline

# Application
PORT=3000
NODE_ENV=development
```

## Deployment

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
   - `POSTGRES_URL` is automatically available

See [backend/VERCEL_DEPLOYMENT.md](./backend/VERCEL_DEPLOYMENT.md) for detailed instructions.

## API Endpoints

### Workflows
- `POST /workflows` - Create workflow
- `GET /workflows` - List workflows
- `GET /workflows/:id` - Get workflow
- `PATCH /workflows/:id` - Update workflow
- `DELETE /workflows/:id` - Delete workflow

### Runs
- `POST /workflows/:id/runs` - Start workflow run
- `GET /runs/:id` - Get run details
- `GET /runs/:id/events` - Get run events/trace

## Implementation Status

- ✅ **Phase 1**: Platform foundation (workflows, runs, steps, events)
- 🚧 **Phase 2**: Agents, tools & LLM integration (in progress)
- ⏳ **Phase 3**: App platform & developer surface
- ⏳ **Phase 4**: RAG memory engine, policy engine, polish

## Documentation

- [MASTER_BLUEPRINT.md](./MASTER_BLUEPRINT.md) - Complete system specification
- [PHASE2_AI_SDK_INTEGRATION.md](./PHASE2_AI_SDK_INTEGRATION.md) - AI SDK integration guide
- [PHASE4_RAG_MEMORY_INTEGRATION.md](./PHASE4_RAG_MEMORY_INTEGRATION.md) - RAG memory engine guide
- [backend/README.md](./backend/README.md) - Backend API documentation
- [backend/VERCEL_DEPLOYMENT.md](./backend/VERCEL_DEPLOYMENT.md) - Deployment guide

## License

UNLICENSED

