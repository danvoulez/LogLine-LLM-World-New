# Sample App Manifests

This directory contains example app manifests demonstrating different use cases and best practices.

## Manifests

### `simple-chat.json`
A minimal chat application that uses natural language database queries.

**Features:**
- Single workflow and action
- Read-only database access
- Simple input mapping

**Use Case:** Basic chat interface for querying data

### `data-analyst.json`
Data analysis application with multiple workflows for querying and reporting.

**Features:**
- Multiple workflows (analyze, report)
- Multiple actions
- Read-only database access
- Organization visibility

**Use Case:** Data team tool for querying and generating reports

### `guest-support-console.json`
Support ticket triage and management system (matches Golden Run example).

**Features:**
- Multiple tools (ticketing, database read/write)
- Multiple workflows (triage, update)
- Draft mode by default for safety
- Organization visibility

**Use Case:** Hotel support team ticket management

### `coding-agent.json`
AI-powered code generation and editing assistant.

**Features:**
- External scopes (GitHub API, file system)
- Multiple workflows (generate, refactor)
- Draft mode for code changes
- Private visibility

**Use Case:** Developer tool for code generation and refactoring

## Usage

To import a manifest:

```bash
curl -X POST http://localhost:3000/apps/import \
  -H "Content-Type: application/json" \
  -d @examples/manifests/simple-chat.json
```

Or using the API:

```typescript
const manifest = require('./examples/manifests/simple-chat.json');
const app = await appsImportService.importManifest(manifest);
```

## Best Practices

1. **Scopes**: Only request the minimum scopes needed
2. **Default Mode**: Use `draft` for write operations, `auto` for read-only
3. **Input Mapping**: Use `$context.*` for user input, `$event.*` for event data
4. **Workflow Aliases**: Use descriptive, app-local aliases
5. **Action IDs**: Use stable, URL-friendly IDs (kebab-case)

## Notes

- All `workflow_ref` values are placeholders - replace with actual workflow IDs
- Ensure referenced tools exist before importing
- Ensure referenced workflows exist before importing

