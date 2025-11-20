# Phase 2 Testing Guide

## ✅ What's Already Done

- ✅ **Database**: Vercel Postgres created and configured
- ✅ **pgvector**: Extension enabled
- ✅ **Phase 2 Implementation**: Complete
  - Tool Runtime Service
  - Agent Runtime Service
  - Natural Language DB Tools
  - Orchestrator with agent/tool node support
- ✅ **API Endpoints**: Tools and Agents CRUD endpoints
- ✅ **Automatic Deployments**: Active

## 🧪 Testing Phase 2

**Base URL**: Replace with your Vercel deployment URL (e.g., `https://your-project.vercel.app`)

### 1. Create a Tool

```bash
curl -X POST https://your-project.vercel.app/tools \
  -H "Content-Type: application/json" \
  -d '{
    "id": "natural_language_db_read",
    "name": "Natural Language DB Read",
    "description": "Query database using natural language",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Your question about the data"
        }
      },
      "required": ["query"]
    },
    "handler_type": "builtin"
  }'
```

### 2. Create an Agent

```bash
curl -X POST https://your-project.vercel.app/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "agent.test_agent",
    "name": "Test Agent",
    "instructions": "You are a helpful assistant that can query the database.",
    "model_profile": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "temperature": 0.7,
      "max_tokens": 1000
    },
    "allowed_tools": ["natural_language_db_read"]
  }'
```

### 3. Create a Workflow with Agent Node

```bash
curl -X POST https://your-project.vercel.app/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent Workflow",
    "definition": {
      "nodes": [
        {
          "id": "agent1",
          "type": "agent",
          "config": {
            "agent_id": "agent.test_agent",
            "input": {
              "query": "Show me all workflows"
            }
          }
        }
      ],
      "edges": [],
      "entryNode": "agent1"
    },
    "type": "linear"
  }'
```

### 4. Start a Run

```bash
curl -X POST https://your-project.vercel.app/workflows/{workflow-id}/runs \
  -H "Content-Type: application/json" \
  -d '{
    "input": {},
    "mode": "draft"
  }'
```

### 5. Monitor the Run

```bash
# Get run status
curl https://your-project.vercel.app/runs/{run-id}

# Stream updates (SSE)
curl -N https://your-project.vercel.app/runs/{run-id}/stream

# Get events
curl https://your-project.vercel.app/runs/{run-id}/events
```

## 📋 Required Environment Variables

Make sure these are set in Vercel:

- ✅ `POSTGRES_URL` - Already set (from Vercel Postgres)
- ⚠️ `OPENAI_API_KEY` - Required for agents to work
- (Optional) `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`

## 🎯 What to Test

1. **Tool Execution**: Can tools be called directly?
2. **Agent Execution**: Can agents execute and call tools?
3. **Natural Language DB**: Can agents query the database?
4. **Workflow Orchestration**: Do workflows execute agent/tool nodes correctly?
5. **Event Logging**: Are all events logged correctly?

## 🐛 Troubleshooting

**Agent not working?**
- Check `OPENAI_API_KEY` is set
- Verify agent is created in database
- Check agent's `allowed_tools` includes the tool

**Tool not found?**
- Verify tool is created in database
- Check tool ID matches exactly

**Database query failing?**
- Verify `POSTGRES_URL` is set
- Check database connection in Vercel logs

---

**Status**: Ready to test Phase 2 functionality!

