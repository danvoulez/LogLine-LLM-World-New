# Quick Start: Template Integration

## Overview

The frontend template is treated as an **App** in our system. It registers via manifest and uses app actions API.

## 3-Step Setup

### Step 1: Create Workflows & Agent

```bash
cd template-examples
chmod +x setup-workflows.sh
./setup-workflows.sh
```

This creates:
- `conversation` workflow
- `code_agent` workflow
- `agent.conversational` with natural language DB tools

### Step 2: Update Manifest & Register App

Update `frontend-app-manifest.json` with workflow IDs from step 1, then:

```bash
curl -X POST http://localhost:3000/apps/import \
  -H "Content-Type: application/json" \
  -d @frontend-app-manifest.json
```

### Step 3: Copy Example Files

Copy from `template-examples/` to your template:
- `lib/backend-client.ts`
- `components/ConversationPanel.tsx`
- `components/ModeSwitcher.tsx`
- `app/conversation/page.tsx`

## Usage

### In Template Code

```typescript
import { executeAppAction } from '@/lib/backend-client';

// Execute conversation
const result = await executeAppAction(
  'coding-agent-frontend',
  'start_conversation',
  { message: 'Show me all workflows' },
  { user_id: 'user-123', tenant_id: 'tenant-1' }
);
```

## Architecture

```
Frontend (App)
  ↓
POST /apps/:app_id/actions/:action_id
  ↓
App Runtime → Resolves Workflow → Orchestrator
  ↓
Agent Runtime → LLM + Tools → Natural Language DB
```

All runs are automatically linked to the app for traceability.

See `template-examples/README.md` for detailed instructions.

