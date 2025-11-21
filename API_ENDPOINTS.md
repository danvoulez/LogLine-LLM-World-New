# 📡 API Endpoints

## Base URL

**Production:** https://logline-llm-world.vercel.app

## Endpoints Disponíveis

### Root & Health

- `GET /api/v1` - API info
- `GET /api/v1/healthz` - Health check

### Workflows

- `GET /api/v1/workflows` - List workflows
- `POST /api/v1/workflows` - Create workflow
- `GET /api/v1/workflows/:id` - Get workflow
- `PATCH /api/v1/workflows/:id` - Update workflow
- `DELETE /api/v1/workflows/:id` - Delete workflow

### Runs

- `POST /api/v1/runs` - Create run
- `GET /api/v1/runs/:id` - Get run
- `GET /api/v1/runs/:id/events` - Get run events
- `GET /api/v1/runs/:id/stream` - Stream run updates (SSE)

### Agents

- `GET /api/v1/agents` - List agents
- `GET /api/v1/agents/:id` - Get agent
- `POST /api/v1/agents` - Create agent

### Tools

- `GET /api/v1/tools` - List tools
- `GET /api/v1/tools/:id` - Get tool

### Apps

- `GET /api/v1/apps` - List apps
- `GET /api/v1/apps/:app_id` - Get app
- `POST /api/v1/apps/import` - Import app manifest
- `POST /api/v1/apps/:app_id/actions/:action_id` - Execute app action

### Files

- `POST /api/v1/files` - Upload file
- `GET /api/v1/files/:id` - Get file
- `GET /api/v1/files/runs/:runId` - Get files for run
- `GET /api/v1/files/apps/:appId` - Get files for app

### Database

- `GET /api/v1/database/check-pgvector` - Check pgvector extension

## Nota

O erro 404 na raiz `/` é normal - a API está em `/api/v1`. Use os endpoints acima!

