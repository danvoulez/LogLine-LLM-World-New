# Template Integration Examples

This directory contains example code and setup scripts for integrating the Vercel coding-agent-template with our LogLine LLM World backend.

## Quick Start

### 1. Setup Backend Workflows

First, create the required workflows and agents:

```bash
# Make setup script executable
chmod +x setup-workflows.sh

# Run setup (creates workflows and agent)
./setup-workflows.sh
```

This will:
- Create `conversation` workflow
- Create `code_agent` workflow  
- Create `agent.conversational` with natural language DB tools
- Output workflow IDs to update in manifest

### 2. Update Frontend Manifest

Update `frontend-app-manifest.json` with the workflow IDs from step 1:

```json
{
  "workflows": [
    {
      "id": "conversation_flow",
      "workflow_ref": "<WORKFLOW_ID_FROM_STEP_1>",
      ...
    }
  ]
}
```

### 3. Register Frontend as App

```bash
curl -X POST http://localhost:3000/apps/import \
  -H "Content-Type: application/json" \
  -d @../frontend-app-manifest.json
```

### 4. Copy Example Files to Template

Copy these files to your template repository:

- `lib/backend-client.ts` → `template/lib/backend-client.ts`
- `components/ConversationPanel.tsx` → `template/components/ConversationPanel.tsx`
- `components/ModeSwitcher.tsx` → `template/components/ModeSwitcher.tsx`
- `app/conversation/page.tsx` → `template/app/conversation/page.tsx`

### 5. Update Template Environment

Add to `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
# Or your deployed backend:
# NEXT_PUBLIC_BACKEND_URL=https://your-backend.vercel.app
```

### 6. Update Template's Main Layout

Add the ModeSwitcher to your main layout:

```tsx
import { ModeSwitcher } from '@/components/ModeSwitcher';

export default function Layout({ children }) {
  return (
    <div>
      <ModeSwitcher />
      {children}
    </div>
  );
}
```

## Architecture

The frontend is treated as an **App** in our system:

1. **App Registration**: Frontend registers via manifest (`POST /apps/import`)
2. **App Actions**: Frontend actions (conversation, code agent) are defined as AppActions
3. **Action Execution**: Frontend calls `POST /apps/:app_id/actions/:action_id`
4. **Traceability**: All runs are linked to the app for full traceability

## Example Usage

### Using App Actions (Preferred)

```typescript
import { executeAppAction, streamRunUpdates } from '@/lib/backend-client';

// Execute conversation action
const result = await executeAppAction(
  'coding-agent-frontend',
  'start_conversation',
  { message: 'Show me all workflows' },
  { user_id: 'user-123', tenant_id: 'tenant-1' }
);

// Stream updates
streamRunUpdates(result.run_id, (data) => {
  console.log('Update:', data);
});
```

### Direct Agent Call (Fallback)

```typescript
import { startConversation } from '@/lib/backend-client';

startConversation(
  'agent.conversational',
  { message: 'Hello', user_id: 'user-123' },
  (data) => console.log('Message:', data)
);
```

## Files

- `lib/backend-client.ts` - Complete API client for our backend
- `components/ConversationPanel.tsx` - Chat interface component
- `components/ModeSwitcher.tsx` - Mode switcher (Code Agent / Conversation)
- `app/conversation/page.tsx` - Conversation page
- `setup-workflows.sh` - Script to create required workflows
- `workflow-definitions.json` - Example workflow definitions

## Next Steps

1. Integrate the example components into your template
2. Update API calls in existing template code to use our backend
3. Test both modes (Code Agent and Conversation)
4. Customize the manifest with your specific workflows and actions

