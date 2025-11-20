# Frontend App Guidelines

## Universal Backend API for macOS, iOS, and Android

This document provides comprehensive guidelines for building frontend applications (macOS, iOS, Android) that integrate with the LogLine LLM World backend.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication & Security](#authentication--security)
3. [API Endpoints](#api-endpoints)
4. [File Storage & Transfer](#file-storage--transfer)
5. [Server-Sent Events (SSE)](#server-sent-events-sse)
6. [Error Handling](#error-handling)
7. [Pagination](#pagination)
8. [Rate Limiting](#rate-limiting)
9. [Platform-Specific Considerations](#platform-specific-considerations)
10. [Best Practices](#best-practices)

## API Overview

### Base URL

```
Production: https://your-backend.vercel.app/api/v1
Development: http://localhost:3000/api/v1
```

### API Versioning

All endpoints are prefixed with `/api/v1`. Future versions will use `/api/v2`, etc.

### Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **SSE Streams**: `text/event-stream`

### Standard Response Format

```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Success"
}
```

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["field1 is required", "field2 must be a string"],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/workflows"
}
```

## Authentication & Security

### Current Status

**Phase 4**: Authentication will be implemented. For now, use:
- `user_id` in request context
- `tenant_id` for multi-tenancy

### Future Authentication

Will support:
- JWT tokens
- OAuth 2.0
- API keys

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
X-User-ID: user-123
X-Tenant-ID: tenant-abc
```

## API Endpoints

### Health Check

```http
GET /healthz
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "uptime": 3600
}
```

### Workflows

#### List Workflows
```http
GET /workflows?page=1&limit=10
```

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 10) - Items per page

**Response:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

#### Get Workflow
```http
GET /workflows/:id
```

#### Create Workflow
```http
POST /workflows
Content-Type: application/json

{
  "name": "My Workflow",
  "version": "1.0.0",
  "definition": { ... },
  "type": "linear"
}
```

### Runs

#### Start Run
```http
POST /workflows/:id/runs
Content-Type: application/json

{
  "input": { ... },
  "mode": "draft"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "running",
  "workflow_id": "uuid",
  "input": { ... }
}
```

#### Get Run
```http
GET /runs/:id
```

#### Get Run Events
```http
GET /runs/:id/events
```

**Response:**
```json
[
  {
    "id": "uuid",
    "kind": "run_started",
    "payload": { ... },
    "ts": "2024-01-01T00:00:00.000Z"
  },
  ...
]
```

#### Stream Run Updates (SSE)
```http
GET /runs/:id/stream
Accept: text/event-stream
```

See [Server-Sent Events](#server-sent-events-sse) section.

### Agents

#### List Agents
```http
GET /agents
```

#### Get Agent
```http
GET /agents/:id
```

#### Create Agent
```http
POST /agents
Content-Type: application/json

{
  "id": "agent.my-agent",
  "name": "My Agent",
  "instructions": "You are a helpful assistant.",
  "model_profile": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 2000
  },
  "allowed_tools": ["natural_language_db_read"]
}
```

#### Agent Conversation (SSE)
```http
POST /agents/:id/conversation
Content-Type: application/json

{
  "message": "Hello",
  "context": { ... },
  "user_id": "user-123",
  "tenant_id": "tenant-abc"
}
```

**Response:** SSE stream (see below)

### Tools

#### List Tools
```http
GET /tools
```

#### Get Tool
```http
GET /tools/:id
```

### Apps

#### Import App Manifest
```http
POST /apps/import
Content-Type: application/json

{
  "version": "1.0.0",
  "app": {
    "id": "my-app",
    "name": "My App",
    ...
  }
}
```

#### List Apps
```http
GET /apps
```

#### Get App
```http
GET /apps/:app_id
```

#### Execute App Action
```http
POST /apps/:app_id/actions/:action_id
Content-Type: application/json

{
  "event": { ... },
  "context": {
    "user_id": "user-123",
    "tenant_id": "tenant-abc"
  }
}
```

**Response:** SSE stream (see below)

## File Storage & Transfer

### Store File

```http
POST /files
Content-Type: application/json

{
  "path": "src/app.ts",
  "content": "export default function App() {...}",
  "run_id": "uuid", // optional
  "app_id": "my-app", // optional
  "tenant_id": "tenant-abc", // optional
  "user_id": "user-123", // optional
  "mime_type": "text/typescript" // optional
}
```

**Response:**
```json
{
  "id": "file-uuid",
  "path": "src/app.ts",
  "size": 1024,
  "version": 1,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### Get File

```http
GET /files/:id
```

**Response:**
```json
{
  "id": "file-uuid",
  "path": "src/app.ts",
  "content": "export default function App() {...}",
  "size": 1024,
  "version": 1,
  ...
}
```

### Get Files by Run

```http
GET /files/runs/:runId
```

### Get Files by App

```http
GET /files/apps/:appId
```

### Update File

```http
PUT /files/:id
Content-Type: application/json

{
  "content": "updated content"
}
```

### Delete File

```http
DELETE /files/:id
```

### Chunked File Transfer (Mobile)

For large files, use chunked transfer:

```http
GET /files/:id/chunks?chunk=0&size=65536
```

**Query Parameters:**
- `chunk` (default: 0) - Chunk index
- `size` (default: 65536) - Chunk size in bytes (max 1MB)

**Response:**
```json
{
  "chunk": "file content chunk...",
  "totalChunks": 10,
  "chunkIndex": 0
}
```

**Headers:**
- `X-Chunk-Index`: Current chunk index
- `X-Total-Chunks`: Total number of chunks

**Example (JavaScript):**
```javascript
async function loadFileChunked(fileId) {
  let content = '';
  let chunk = 0;
  
  while (true) {
    const response = await fetch(
      `/api/v1/files/${fileId}/chunks?chunk=${chunk}&size=65536`
    );
    const data = await response.json();
    
    content += data.chunk;
    
    if (chunk >= data.totalChunks - 1) break;
    chunk++;
  }
  
  return content;
}
```

## Server-Sent Events (SSE)

### Run Stream

```http
GET /runs/:id/stream
Accept: text/event-stream
```

**Event Types:**
- `connected` - Connection established
- `update` - Run status update
- `complete` - Run completed
- `error` - Error occurred

**Example:**
```
data: {"type":"connected","runId":"uuid"}

data: {"type":"update","run":{"id":"uuid","status":"running"}}

data: {"type":"complete","status":"completed"}
```

### Agent Conversation Stream

```http
POST /agents/:id/conversation
Content-Type: application/json
Accept: text/event-stream
```

**Event Types:**
- `connected` - Connection established
- `text` - Agent text response
- `tool_call` - Tool call made by agent
- `complete` - Conversation complete
- `error` - Error occurred

**Example:**
```
data: {"type":"connected","runId":"uuid","stepId":"uuid"}

data: {"type":"text","content":"Hello! How can I help?"}

data: {"type":"tool_call","toolCall":{"toolName":"natural_language_db_read","args":{...},"result":{...}}}

data: {"type":"complete","runId":"uuid","result":"..."}
```

### SSE Client Implementation

#### JavaScript/TypeScript

```typescript
class SSEClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  async connect(
    url: string,
    options: RequestInit,
    onMessage: (data: any) => void,
    onError?: (error: Error) => void,
  ): Promise<() => void> {
    const connect = async (): Promise<() => void> => {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Accept: 'text/event-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            throw new Error('Connection closed');
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                onMessage(data);

                if (data.type === 'complete' || data.type === 'error') {
                  return () => reader.cancel();
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);

          await new Promise((resolve) =>
            setTimeout(resolve, this.reconnectDelay),
          );

          return connect();
        } else {
          if (onError) {
            onError(error as Error);
          }
          throw error;
        }
      }
    };

    return connect();
  }
}
```

#### Swift (iOS)

```swift
import Foundation

class SSEClient {
    private var task: URLSessionDataTask?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    
    func connect(
        url: URL,
        onMessage: @escaping ([String: Any]) -> Void,
        onError: @escaping (Error) -> Void
    ) {
        var request = URLRequest(url: url)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        
        task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                if self.reconnectAttempts < self.maxReconnectAttempts {
                    self.reconnectAttempts += 1
                    DispatchQueue.main.asyncAfter(deadline: .now() + Double(self.reconnectAttempts)) {
                        self.connect(url: url, onMessage: onMessage, onError: onError)
                    }
                } else {
                    onError(error)
                }
                return
            }
            
            guard let data = data else { return }
            
            let string = String(data: data, encoding: .utf8) ?? ""
            let lines = string.components(separatedBy: "\n")
            
            for line in lines {
                if line.hasPrefix("data: ") {
                    let jsonString = String(line.dropFirst(6))
                    if let jsonData = jsonString.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                        onMessage(json)
                    }
                }
            }
        }
        
        task?.resume()
    }
    
    func disconnect() {
        task?.cancel()
    }
}
```

#### Kotlin (Android)

```kotlin
import okhttp3.*
import okio.*

class SSEClient {
    private var client: OkHttpClient = OkHttpClient()
    private var request: Request? = null
    private var call: Call? = null
    
    fun connect(
        url: String,
        onMessage: (Map<String, Any>) -> Unit,
        onError: (Exception) -> Unit
    ) {
        request = Request.Builder()
            .url(url)
            .addHeader("Accept", "text/event-stream")
            .build()
        
        call = client.newCall(request!!)
        
        call!!.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onError(e)
            }
            
            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    onError(Exception("HTTP ${response.code}"))
                    return
                }
                
                val source = response.body?.source()
                val buffer = Buffer()
                
                while (true) {
                    val line = source?.readUtf8Line() ?: break
                    
                    if (line.startsWith("data: ")) {
                        val jsonString = line.substring(6)
                        try {
                            val json = JSONObject(jsonString)
                            val map = json.toMap()
                            onMessage(map)
                        } catch (e: Exception) {
                            onError(e)
                        }
                    }
                }
            }
        })
    }
    
    fun disconnect() {
        call?.cancel()
    }
}
```

## Error Handling

### Standard Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["field1 is required"],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/workflows"
}
```

### Handling Errors

**Always check response status:**
```javascript
const response = await fetch('/api/v1/workflows');
if (!response.ok) {
  const error = await response.json();
  // Handle error
  throw new Error(error.message);
}
```

## Pagination

All list endpoints support pagination:

```http
GET /workflows?page=1&limit=10
```

**Response:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Rate Limiting

Rate limiting is implemented to prevent abuse. Current limits:
- **Default**: 100 requests per minute per IP
- **SSE Streams**: 10 concurrent connections per IP

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

**429 Response:**
```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

## Platform-Specific Considerations

### iOS (iPhone/iPad)

1. **Background Execution**: SSE connections are killed when app goes to background
   - Implement reconnection logic
   - Sync state on reconnect

2. **Network Changes**: Handle network interruptions gracefully
   - Queue requests when offline
   - Flush queue when online

3. **File Storage**: No local filesystem access
   - Use backend file storage API
   - Cache in Core Data or SQLite

4. **Memory**: Stricter memory limits
   - Use chunked file transfer
   - Implement virtual scrolling for large lists

### Android

1. **Background Execution**: Similar to iOS
   - Use WorkManager for background tasks
   - Implement reconnection logic

2. **Network**: Handle network changes
   - Use ConnectivityManager
   - Queue requests when offline

3. **File Storage**: Can use local storage
   - Still recommend backend storage for sync
   - Use Room database for caching

### macOS

1. **Background Execution**: More lenient
   - Still implement reconnection for reliability

2. **File Storage**: Full filesystem access
   - Can use local files
   - Still recommend backend for sync

## Best Practices

### 1. Always Handle Errors

```javascript
try {
  const response = await fetch('/api/v1/workflows');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  // Handle error appropriately
  console.error('Request failed:', error);
}
```

### 2. Implement Retry Logic

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 3. Use Chunked Transfer for Large Files

Always use chunked transfer for files > 64KB on mobile.

### 4. Implement SSE Reconnection

Always implement reconnection logic for SSE streams.

### 5. Cache Responses

Cache responses locally to reduce network usage and improve offline experience.

### 6. Show Loading States

Always show loading states for async operations.

### 7. Handle Network Changes

Detect network changes and handle gracefully (queue requests, show offline indicator).

## Example: Complete App Integration

See `template-examples/` directory for complete React/Next.js examples.

## Support

For questions or issues, refer to:
- [MASTER_BLUEPRINT.md](./MASTER_BLUEPRINT.md) - Complete system specification
- [backend/README.md](./backend/README.md) - Backend API documentation

