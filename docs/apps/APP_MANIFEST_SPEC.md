# App Manifest Specification

## Overview

App manifests define applications in the LogLine LLM World platform. They specify:
- App metadata (name, description, visibility)
- Permissions (scopes for tools, memory, external resources)
- Workflows (linked to existing workflows)
- Actions (user-facing operations that trigger workflows)

## Version

Current version: **1.0.0**

## Structure

```json
{
  "version": "1.0.0",
  "app": {
    "id": "string",
    "name": "string",
    "description": "string (optional)",
    "icon": "string (optional)",
    "owner": "string (optional)",
    "visibility": "private|org|public",
    "scopes": {
      "tools": ["string"],
      "memory": ["string"],
      "external": ["string"]
    },
    "workflows": [
      {
        "id": "string",
        "workflow_ref": "uuid",
        "label": "string",
        "default_mode": "draft|auto"
      }
    ],
    "actions": [
      {
        "id": "string",
        "label": "string",
        "workflow_id": "string",
        "input_mapping": {}
      }
    ]
  }
}
```

## Fields

### Root Level

#### `version` (required)
- **Type**: `string`
- **Value**: `"1.0.0"` (currently only version supported)
- **Description**: Manifest format version

### App Object

#### `id` (required)
- **Type**: `string`
- **Format**: URL-friendly identifier (kebab-case recommended)
- **Description**: Unique app identifier
- **Example**: `"guest-support-console"`

#### `name` (required)
- **Type**: `string`
- **Description**: Human-readable app name
- **Example**: `"Guest Support Console"`

#### `description` (optional)
- **Type**: `string`
- **Description**: App description
- **Example**: `"Support ticket triage and management system"`

#### `icon` (optional)
- **Type**: `string`
- **Description**: Icon identifier or emoji
- **Example**: `"🎫"` or `"icon-ticket"`

#### `owner` (optional)
- **Type**: `string`
- **Description**: Owner identifier (team, user, etc.)
- **Example**: `"support-team"`

#### `visibility` (optional)
- **Type**: `"private" | "org" | "public"`
- **Default**: `"private"`
- **Description**: App visibility level
  - `private`: Only owner can access
  - `org`: Organization members can access
  - `public`: Anyone can access

### Scopes

#### `scopes.tools` (optional)
- **Type**: `string[]`
- **Description**: List of tool IDs the app can use
- **Validation**: All tool IDs must exist in the system
- **Example**: `["natural_language_db_read", "ticketing.list_open"]`

#### `scopes.memory` (optional)
- **Type**: `string[]`
- **Description**: List of memory resource IDs the app can access
- **Example**: `["memory-user-preferences", "memory-conversation-history"]`

#### `scopes.external` (optional)
- **Type**: `string[]`
- **Description**: List of external resource IDs the app can access
- **Example**: `["github-api", "slack-api"]`

### Workflows

#### `workflows[].id` (required)
- **Type**: `string`
- **Description**: App-local workflow alias (must be unique within app)
- **Example**: `"triage"`

#### `workflows[].workflow_ref` (required)
- **Type**: `string` (UUID)
- **Description**: Reference to existing workflow ID
- **Validation**: Workflow must exist in the system
- **Example**: `"550e8400-e29b-41d4-a716-446655440000"`

#### `workflows[].label` (required)
- **Type**: `string`
- **Description**: Human-readable workflow label
- **Example**: `"Ticket Triage"`

#### `workflows[].default_mode` (optional)
- **Type**: `"draft" | "auto"`
- **Default**: `"draft"`
- **Description**: Default execution mode for this workflow
  - `draft`: Requires review before execution
  - `auto`: Executes automatically

### Actions

#### `actions[].id` (required)
- **Type**: `string`
- **Format**: URL-friendly identifier (kebab-case recommended)
- **Description**: Unique action identifier within app
- **Example**: `"triage_tickets"`

#### `actions[].label` (required)
- **Type**: `string`
- **Description**: Human-readable action label
- **Example**: `"Triage Tickets"`

#### `actions[].workflow_id` (required)
- **Type**: `string`
- **Description**: Reference to workflow alias (from `workflows[].id`)
- **Validation**: Must reference a workflow alias defined in `workflows`
- **Example**: `"triage"`

#### `actions[].input_mapping` (required)
- **Type**: `object`
- **Description**: Maps action input to workflow input
- **Syntax**: Supports `$context.*`, `$event.*`, `$input.*`, and literal values
- **Example**:
  ```json
  {
    "query": "$context.message",
    "filters": "$context.filters",
    "limit": 10
  }
  ```

## Input Mapping Syntax

### Variables

#### `$context.*`
- **Description**: User-provided context (from action call)
- **Example**: `$context.message` → `actionInput.message`

#### `$event.*`
- **Description**: Event data (from triggering event)
- **Example**: `$event.user_id` → `eventData.user_id`

#### `$input.*`
- **Description**: Direct input passthrough
- **Example**: `$input.query` → `actionInput.query`

### Literal Values
- Numbers, strings, booleans, objects, arrays are passed as-is
- **Example**: `"limit": 10` → `workflowInput.limit = 10`

## Validation Rules

1. **Version**: Must be `"1.0.0"`
2. **App ID**: Required, non-empty string
3. **App Name**: Required, non-empty string
4. **Visibility**: Must be one of: `private`, `org`, `public`
5. **Tool Scopes**: All tool IDs must exist
6. **Workflow References**: All `workflow_ref` must exist
7. **Workflow Aliases**: Must be unique within app
8. **Action IDs**: Must be unique within app
9. **Action Workflow References**: Must reference valid workflow alias

## Examples

See `backend/examples/manifests/` for complete examples:
- `simple-chat.json` - Minimal chat app
- `data-analyst.json` - Data analysis app
- `guest-support-console.json` - Support ticket system
- `coding-agent.json` - Code generation app

## Import API

```http
POST /apps/import
Content-Type: application/json

{
  "version": "1.0.0",
  "app": { ... }
}
```

**Response:**
```json
{
  "id": "app-id",
  "name": "App Name",
  "scopes": [...],
  "workflows": [...],
  "actions": [...]
}
```

## Best Practices

1. **Minimal Scopes**: Only request scopes you need
2. **Draft Mode**: Use `draft` for write operations
3. **Descriptive IDs**: Use kebab-case, descriptive identifiers
4. **Input Mapping**: Prefer `$context.*` for user input
5. **Workflow Aliases**: Use app-local, meaningful aliases
6. **Error Handling**: Validate manifest before import

## Versioning

- Current: `1.0.0`
- Future versions will maintain backward compatibility
- Breaking changes will increment major version

