/**
 * Conversation Panel Component
 * 
 * Copy this to your template's components/ directory
 * Uses app actions API (preferred) or direct agent calls (fallback)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { executeAppAction, startConversation, streamRunUpdates } from '@/lib/backend-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  runId?: string;
}

interface ConversationPanelProps {
  appId?: string; // App ID (preferred - uses app actions)
  agentId?: string; // Direct agent ID (fallback)
  userId?: string;
  tenantId?: string;
}

export function ConversationPanel({ 
  appId, 
  agentId, 
  userId, 
  tenantId = 'default-tenant' 
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsLoading(true);

    try {
      if (appId) {
        // Use app action (preferred method)
        const result = await executeAppAction(
          appId,
          'start_conversation',
          { message: messageText },
          { 
            user_id: userId, 
            tenant_id: tenantId,
            message: messageText,
          },
        );

        setCurrentRunId(result.run_id);

        // Stream run updates
        cleanupRef.current = await streamRunUpdates(
          result.run_id,
          (data) => {
            if (data.type === 'update') {
              // Update with latest run status
              if (data.run?.result) {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    return [...prev.slice(0, -1), {
                      ...last,
                      content: typeof data.run.result === 'string' 
                        ? data.run.result 
                        : data.run.result.text || JSON.stringify(data.run.result),
                    }];
                  }
                  return prev;
                });
              }
            } else if (data.type === 'complete') {
              setIsLoading(false);
              cleanupRef.current = null;
            } else if (data.type === 'error') {
              setIsLoading(false);
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `Error: ${data.error}` },
              ]);
              cleanupRef.current = null;
            }
          },
          (error) => {
            setIsLoading(false);
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `Error: ${error.message}` },
            ]);
            cleanupRef.current = null;
          },
        );

        // Add placeholder assistant message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '...', runId: result.run_id },
        ]);
      } else if (agentId) {
        // Fallback to direct agent call
        let assistantContent = '';
        const toolCalls: any[] = [];

        cleanupRef.current = await startConversation(
          agentId,
          { 
            message: messageText,
            user_id: userId,
            tenant_id: tenantId,
          },
          (data) => {
            if (data.type === 'text') {
              assistantContent += data.content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [...prev.slice(0, -1), { 
                    ...last, 
                    content: assistantContent,
                    toolCalls: [...toolCalls],
                  }];
                }
                return [...prev, { 
                  role: 'assistant', 
                  content: assistantContent,
                  toolCalls: [...toolCalls],
                }];
              });
            } else if (data.type === 'tool_call') {
              toolCalls.push(data.toolCall);
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [...prev.slice(0, -1), { 
                    ...last, 
                    toolCalls: [...toolCalls],
                  }];
                }
                return [...prev, { 
                  role: 'assistant', 
                  content: assistantContent,
                  toolCalls: [...toolCalls],
                }];
              });
            } else if (data.type === 'complete') {
              setIsLoading(false);
              cleanupRef.current = null;
            } else if (data.type === 'error') {
              setIsLoading(false);
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `Error: ${data.error}` },
              ]);
              cleanupRef.current = null;
            }
          },
          (error) => {
            setIsLoading(false);
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `Error: ${error.message}` },
            ]);
            cleanupRef.current = null;
          },
        );

        // Add placeholder assistant message
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '...', toolCalls: [] },
        ]);
      } else {
        throw new Error('Either appId or agentId must be provided');
      }
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
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 text-xs opacity-75 border-t pt-2">
                  <p className="font-semibold">Tool calls: {msg.toolCalls.length}</p>
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="mt-1 p-1 bg-gray-100 rounded">
                      <code className="text-xs">{tc.toolName || tc.toolId}</code>
                      {tc.result && (
                        <div className="mt-1 text-xs opacity-60">
                          {typeof tc.result === 'string' 
                            ? tc.result 
                            : JSON.stringify(tc.result, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {msg.runId && (
                <div className="mt-2 text-xs opacity-50">
                  Run ID: {msg.runId}
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
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

