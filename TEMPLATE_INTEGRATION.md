# Template Frontend Integration Guide

This guide explains how to adapt the [Vercel coding-agent-template](https://github.com/vercel-labs/coding-agent-template) frontend to work with our LogLine LLM World backend.

## Core Principle

**The frontend is treated as an App in our app platform. It registers via manifest and uses app actions API.**

This means:
1. Frontend registers as an App using `POST /apps/import` with a manifest
2. Frontend actions (conversation, code agent) are defined as AppActions
3. Frontend calls `POST /apps/:app_id/actions/:action_id` instead of direct agent calls
4. All runs are automatically linked to the app for traceability

## Backend Endpoints Available

### Agents
- `GET /agents` - List all agents
- `GET /agents/:id` - Get agent details
- `POST /agents` - Create agent
- `POST /agents/:id/conversation` - Start conversation with agent (streaming SSE)

### Apps
- `GET /apps/:app_id` - Get app details
- `POST /apps/:app_id/actions/:action_id` - Execute app action

### Runs
- `GET /runs/:id` - Get run details
- `GET /runs/:id/events` - Get run events/trace
- `GET /runs/:id/stream` - Stream run updates (SSE)

### Workflows
- `POST /workflows/:id/runs` - Start workflow run

## Step 1: Register Frontend as an App

First, import the frontend app manifest to register it as an app:

```bash
curl -X POST http://localhost:3000/apps/import \
  -H "Content-Type: application/json" \
  -d @frontend-app-manifest.json
```

Or use the manifest from this repo: `frontend-app-manifest.json`

This creates:
- An App entity with ID `coding-agent-frontend`
- AppActions: `start_conversation`, `execute_code_agent`
- AppScopes: Defines which tools the frontend can access

## Step 2: Create API Client

Create or update `lib/backend-client.ts` in the template:

```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface ConversationMessage {
  message: string;
  context?: Record<string, any>;
  conversation_id?: string;
  user_id?: string;
  tenant_id?: string;
}

export interface Agent {
  id: string;
  name: string;
  instructions: string;
  model_profile: {
    provider: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
  };
  allowed_tools: string[];
}

// Fetch all agents
export async function getAgents(): Promise<Agent[]> {
  const response = await fetch(`${BACKEND_URL}/agents`);
  if (!response.ok) {
    throw new Error('Failed to fetch agents');
  }
  return response.json();
}

// Execute app action (preferred method)
export async function executeAppAction(
  appId: string,
  actionId: string,
  event: Record<string, any>,
  context: Record<string, any>,
  onMessage?: (data: any) => void,
): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/apps/${appId}/actions/${actionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event, context }),
  });

  if (!response.ok) {
    throw new Error('Failed to execute action');
  }

  const result = await response.json();

  // If action returns a run_id, stream updates
  if (result.run_id && onMessage) {
    streamRunUpdates(result.run_id, onMessage);
  }

  return result;
}

// Stream run updates
async function streamRunUpdates(runId: string, onMessage: (data: any) => void) {
  const response = await fetch(`${BACKEND_URL}/runs/${runId}/stream`);
  
  if (!response.ok) {
    throw new Error('Failed to stream run updates');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            onMessage(data);
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  }
}

// Start conversation with agent directly (alternative, for backward compatibility)
export async function startConversation(
  agentId: string,
  message: ConversationMessage,
  onMessage: (data: any) => void,
): Promise<EventSource> {
  const eventSource = new EventSource(
    `${BACKEND_URL}/agents/${agentId}/conversation?` +
    new URLSearchParams({
      message: message.message,
      ...(message.context && { context: JSON.stringify(message.context) }),
      ...(message.user_id && { user_id: message.user_id }),
      ...(message.tenant_id && { tenant_id: message.tenant_id }),
    })
  );

  // For POST with body, we need to use fetch with streaming
  // Alternative: Use fetch with ReadableStream
  const response = await fetch(`${BACKEND_URL}/agents/${agentId}/conversation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error('Failed to start conversation');
  }

  // Handle SSE stream
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              onMessage(data);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    })();
  }

  return eventSource as any;
}

// Execute app action
export async function executeAppAction(
  appId: string,
  actionId: string,
  event: Record<string, any>,
  context: Record<string, any>,
): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/apps/${appId}/actions/${actionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event, context }),
  });

  if (!response.ok) {
    throw new Error('Failed to execute action');
  }

  return response.json();
}

// Get run events
export async function getRunEvents(runId: string): Promise<any[]> {
  const response = await fetch(`${BACKEND_URL}/runs/${runId}/events`);
  if (!response.ok) {
    throw new Error('Failed to fetch run events');
  }
  return response.json();
}
```

## Step 3: Create Conversation Component

Create `components/conversation-panel.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { startConversation, ConversationMessage } from '@/lib/backend-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
}

export function ConversationPanel({ appId, userId, tenantId }: {
  appId?: string; // App ID (preferred)
  agentId?: string; // Direct agent ID (fallback)
  userId?: string;
  tenantId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const message: ConversationMessage = {
      message: input,
      user_id: userId,
      tenant_id: tenantId || 'default-tenant',
    };

    let assistantContent = '';
    const toolCalls: any[] = [];

    try {
      // Use app action if appId is provided
      if (appId) {
        await executeAppAction(
          appId,
          'start_conversation',
          { message: input },
          { user_id: userId, tenant_id: tenantId || 'default-tenant' },
          (data) => {
        if (data.type === 'text') {
          assistantContent += data.content;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: assistantContent }];
            }
            return [...prev, { role: 'assistant', content: assistantContent, toolCalls }];
          });
        } else if (data.type === 'tool_call') {
          toolCalls.push(data.toolCall);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, toolCalls: [...toolCalls] }];
            }
            return [...prev, { role: 'assistant', content: assistantContent, toolCalls: [...toolCalls] }];
          });
        } else if (data.type === 'complete') {
          setIsLoading(false);
        } else if (data.type === 'error') {
          setIsLoading(false);
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `Error: ${data.error}` },
          ]);
        }
      });
    } catch (error: any) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${error.message}` },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p>{msg.content}</p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 text-xs opacity-75">
                  <p>Tool calls: {msg.toolCalls.length}</p>
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="mt-1">
                      <code className="text-xs">{tc.toolName}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg p-3">
              <p className="text-gray-500">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border rounded-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
```

      });
      } else if (agentId) {
        // Fallback to direct agent call
        await startConversation(agentId, message, (data) => {

Create `app/conversation/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { ConversationPanel } from '@/components/conversation-panel';
import { getAgents, Agent } from '@/lib/backend-client';

export default function ConversationPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const agentList = await getAgents();
      setAgents(agentList);
      if (agentList.length > 0) {
        // Find agent with natural language DB tools or use first one
        const dbAgent = agentList.find((a) =>
          a.allowed_tools?.includes('natural_language_db_read')
        );
        setSelectedAgentId(dbAgent?.id || agentList[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load agents:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading agents...</div>;
  }

  if (agents.length === 0) {
    return (
      <div className="p-8">
        <p>No agents available. Create an agent in the backend first.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4">
        <h1 className="text-2xl font-bold">Conversation</h1>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="mt-2 px-4 py-2 border rounded-lg"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        {selectedAgentId && (
          <ConversationPanel
            agentId={selectedAgentId}
            userId={undefined} // Get from auth
            tenantId="default-tenant" // Get from auth
          />
        )}
      </div>
    </div>
  );
}
```

        });
      }
    } catch (error: any) {

Update your main layout or navigation to include a mode switcher:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ModeSwitcher() {
  const pathname = usePathname();
  const isConversation = pathname?.startsWith('/conversation');

  return (
    <div className="flex gap-2 p-4 border-b">
      <Link
        href="/"
        className={`px-4 py-2 rounded ${
          !isConversation ? 'bg-blue-500 text-white' : 'bg-gray-200'
        }`}
      >
        Code Agent
      </Link>
      <Link
        href="/conversation"
        className={`px-4 py-2 rounded ${
          isConversation ? 'bg-blue-500 text-white' : 'bg-gray-200'
        }`}
      >
        Conversation
      </Link>
    </div>
  );
}
```

## Step 4: Create Conversation Page

Add to your template's `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
# Or your deployed backend URL:
# NEXT_PUBLIC_BACKEND_URL=https://your-backend.vercel.app
```

## Step 5: Environment Variables

Replace template's internal agent API calls with calls to our backend:

1. Find where template calls its internal API routes
2. Replace with calls to `getAgents()` and `startConversation()`
3. Update agent creation to use `POST /agents`

## Step 6: Update Template's Agent Calls

Replace template's internal agent API calls with:
1. **Preferred**: Use `executeAppAction()` with app ID and action ID
2. **Fallback**: Use direct agent calls for backward compatibility

## Testing

1. Start your backend: `cd backend && npm run start:dev`
2. **Register the frontend as an app**:
   ```bash
   curl -X POST http://localhost:3000/apps/import \
     -H "Content-Type: application/json" \
     -d @frontend-app-manifest.json
   ```
3. Create required workflows (conversation, code_agent) or update manifest with existing workflow IDs
4. Create a test agent with natural language DB tools:
   ```bash
   curl -X POST http://localhost:3000/agents \
     -H "Content-Type: application/json" \
     -d '{
       "id": "agent.conversational",
       "name": "Conversational Agent",
       "instructions": "You are a helpful assistant that can read and write to the database using natural language.",
       "model_profile": {
         "provider": "openai",
         "model": "gpt-4o-mini",
         "temperature": 0.7
       },
       "allowed_tools": ["natural_language_db_read", "natural_language_db_write"]
     }'
   ```
3. Start template frontend: `npm run dev`
4. Navigate to `/conversation` and test a query like "Show me all workflows"

## Notes

- The conversation endpoint uses Server-Sent Events (SSE) for streaming
- All conversations create runs and steps in our backend for full traceability
- Tool calls are automatically logged as events
- The template can display traces using `GET /runs/:id/events`

