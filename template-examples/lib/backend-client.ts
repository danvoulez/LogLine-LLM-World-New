/**
 * Backend API Client for LogLine LLM World
 * 
 * Copy this file to your template's lib/ directory
 * Update BACKEND_URL to point to your backend deployment
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

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

export interface App {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  visibility: 'private' | 'org' | 'public';
  scopes?: any[];
  workflows?: any[];
  actions?: any[];
}

export interface ConversationMessage {
  message: string;
  context?: Record<string, any>;
  conversation_id?: string;
  user_id?: string;
  tenant_id?: string;
}

export interface Run {
  id: string;
  workflow_id: string;
  status: string;
  mode: string;
  input: Record<string, any>;
  result?: Record<string, any>;
  app_id?: string;
  app_action_id?: string;
}

// Fetch all agents
export async function getAgents(): Promise<Agent[]> {
  const response = await fetch(`${BACKEND_URL}/agents`);
  if (!response.ok) {
    throw new Error('Failed to fetch agents');
  }
  return response.json();
}

// Fetch all apps
export async function getApps(): Promise<App[]> {
  const response = await fetch(`${BACKEND_URL}/apps`);
  if (!response.ok) {
    throw new Error('Failed to fetch apps');
  }
  return response.json();
}

// Get app by ID
export async function getApp(appId: string): Promise<App> {
  const response = await fetch(`${BACKEND_URL}/apps/${appId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch app');
  }
  return response.json();
}

// Import app manifest
export async function importApp(manifest: any): Promise<App> {
  const response = await fetch(`${BACKEND_URL}/apps/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(manifest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to import app: ${error}`);
  }

  return response.json();
}

// Execute app action (preferred method)
export async function executeAppAction(
  appId: string,
  actionId: string,
  event: Record<string, any>,
  context: Record<string, any>,
): Promise<{ run_id: string; status: string; workflow_id: string }> {
  const response = await fetch(`${BACKEND_URL}/apps/${appId}/actions/${actionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event, context }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to execute action: ${error}`);
  }

  return response.json();
}

// Stream run updates (SSE)
export async function streamRunUpdates(
  runId: string,
  onMessage: (data: any) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  const response = await fetch(`${BACKEND_URL}/runs/${runId}/stream`);

  if (!response.ok) {
    throw new Error('Failed to stream run updates');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  let isActive = true;

  if (reader) {
    (async () => {
      try {
        while (isActive) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                onMessage(data);
                
                // Stop if complete or error
                if (data.type === 'complete' || data.type === 'error') {
                  isActive = false;
                  if (data.type === 'error' && onError) {
                    onError(new Error(data.error || 'Unknown error'));
                  }
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
        isActive = false;
      }
    })();
  }

  // Return cleanup function
  return () => {
    isActive = false;
    reader?.cancel();
  };
}

// Start conversation with agent directly (alternative method)
export async function startConversation(
  agentId: string,
  message: ConversationMessage,
  onMessage: (data: any) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
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

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  let isActive = true;

  if (reader) {
    (async () => {
      try {
        while (isActive) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                onMessage(data);
                
                if (data.type === 'complete' || data.type === 'error') {
                  isActive = false;
                  if (data.type === 'error' && onError) {
                    onError(new Error(data.error || 'Unknown error'));
                  }
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
        isActive = false;
      }
    })();
  }

  return () => {
    isActive = false;
    reader?.cancel();
  };
}

// Get run details
export async function getRun(runId: string): Promise<Run> {
  const response = await fetch(`${BACKEND_URL}/runs/${runId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch run');
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

