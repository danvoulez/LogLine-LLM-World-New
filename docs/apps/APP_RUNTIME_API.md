# App Runtime API

## Overview

The App Runtime API allows frontends to execute app actions and retrieve app information. Actions trigger workflows with input mapping and scope enforcement.

## Base URL

```
/api/apps
```

## Endpoints

### Import App Manifest

```http
POST /apps/import
Content-Type: application/json
```

**Request Body:**
```json
{
  "version": "1.0.0",
  "app": {
    "id": "app-id",
    "name": "App Name",
    ...
  }
}
```

**Response:** `200 OK`
```json
{
  "id": "app-id",
  "name": "App Name",
  "description": "...",
  "scopes": [...],
  "workflows": [...],
  "actions": [...]
}
```

**Errors:**
- `400 Bad Request` - Invalid manifest structure
- `404 Not Found` - Referenced workflow/tool not found
- `422 Unprocessable Entity` - Validation errors

---

### List Apps

```http
GET /apps
```

**Query Parameters:**
- `visibility` (optional): Filter by visibility (`private`, `org`, `public`)

**Response:** `200 OK`
```json
[
  {
    "id": "app-id",
    "name": "App Name",
    "description": "...",
    "visibility": "private"
  }
]
```

---

### Get App Details

```http
GET /apps/:app_id
```

**Response:** `200 OK`
```json
{
  "id": "app-id",
  "name": "App Name",
  "description": "...",
  "scopes": [
    {
      "id": "scope-id",
      "scope_type": "tool",
      "scope_value": "natural_language_db_read"
    }
  ],
  "workflows": [
    {
      "id": "workflow-id",
      "alias": "main",
      "label": "Main Workflow",
      "workflow_id": "workflow-uuid"
    }
  ],
  "actions": [
    {
      "id": "action-id",
      "label": "Action Label",
      "workflow_id": "main",
      "input_mapping": {}
    }
  ]
}
```

**Errors:**
- `404 Not Found` - App not found

---

### Execute App Action

```http
POST /apps/:app_id/actions/:action_id
Content-Type: application/json
```

**Request Body:**
```json
{
  "context": {
    "message": "Hello",
    "user_id": "user-123"
  }
}
```

**Response:** `200 OK`
```json
{
  "run_id": "run-uuid",
  "status": "pending",
  "workflow_id": "workflow-uuid",
  "app_id": "app-id",
  "app_action_id": "action-id"
}
```

**Input Mapping:**
The `context` object is mapped to workflow input using the action's `input_mapping`:

```json
{
  "input_mapping": {
    "query": "$context.message",
    "user_id": "$context.user_id"
  }
}
```

Results in workflow input:
```json
{
  "query": "Hello",
  "user_id": "user-123"
}
```

**Errors:**
- `404 Not Found` - App or action not found
- `403 Forbidden` - Scope denied (tool not in app scopes)
- `400 Bad Request` - Invalid input

---

### Stream Run Updates

```http
GET /runs/:run_id/stream
Accept: text/event-stream
```

**Response:** `200 OK` (Server-Sent Events)

```
event: run_started
data: {"run_id": "...", "status": "running"}

event: step_started
data: {"step_id": "...", "node_id": "start"}

event: step_completed
data: {"step_id": "...", "output": {...}}

event: run_completed
data: {"run_id": "...", "status": "completed", "result": {...}}
```

**Event Types:**
- `run_started` - Run execution started
- `step_started` - Step execution started
- `step_completed` - Step execution completed
- `tool_call` - Tool was called
- `llm_call` - LLM was called
- `policy_eval` - Policy evaluation (scope check)
- `run_completed` - Run execution completed
- `run_failed` - Run execution failed

---

## Scope Enforcement

When an app action triggers a workflow that calls a tool:

1. **Check App Scope**: System checks if app has tool in `scopes.tools`
2. **Allow/Deny**: 
   - ✅ If scope exists → Tool executes
   - ❌ If scope missing → `403 Forbidden` with `SCOPE_DENIED` error
3. **Log Event**: `policy_eval` event logged with result

**Example Error:**
```json
{
  "statusCode": 403,
  "error": "SCOPE_DENIED",
  "message": "Scope denied: App 'app-id' does not have permission to use tool 'unauthorized-tool'",
  "app_id": "app-id",
  "scope_type": "tool",
  "scope_value": "unauthorized-tool"
}
```

## Input Mapping Resolution

### Supported Variables

#### `$context.*`
Maps to values from action call context:
```json
{
  "context": { "message": "Hello" },
  "input_mapping": { "query": "$context.message" }
}
→ { "query": "Hello" }
```

#### `$event.*`
Maps to event data (if triggered by event):
```json
{
  "event": { "user_id": "user-123" },
  "input_mapping": { "user_id": "$event.user_id" }
}
→ { "user_id": "user-123" }
```

#### `$input.*`
Direct passthrough:
```json
{
  "context": { "query": "Hello" },
  "input_mapping": { "query": "$input.query" }
}
→ { "query": "Hello" }
```

### Literal Values
Passed as-is:
```json
{
  "input_mapping": { "limit": 10, "enabled": true }
}
→ { "limit": 10, "enabled": true }
```

## Example Flow

### 1. Import App
```bash
curl -X POST http://localhost:3000/apps/import \
  -H "Content-Type: application/json" \
  -d @manifest.json
```

### 2. Execute Action
```bash
curl -X POST http://localhost:3000/apps/simple-chat/actions/send_message \
  -H "Content-Type: application/json" \
  -d '{"context": {"message": "Show me all workflows"}}'
```

### 3. Stream Updates
```bash
curl http://localhost:3000/runs/{run_id}/stream
```

## Error Handling

All errors follow standard HTTP status codes:

- `400 Bad Request` - Invalid request format
- `403 Forbidden` - Scope denied
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "statusCode": 403,
  "error": "SCOPE_DENIED",
  "message": "Detailed error message",
  "app_id": "...",
  "scope_type": "tool",
  "scope_value": "..."
}
```

## Rate Limiting

- Default: 100 requests per minute per IP
- Scope checks are logged but don't count against rate limit
- Streaming connections are excluded from rate limiting

## Authentication

Currently, authentication is not implemented (Phase 4). All endpoints are publicly accessible.

Future: JWT tokens will be required, and `user_id`/`tenant_id` will be extracted from token.

