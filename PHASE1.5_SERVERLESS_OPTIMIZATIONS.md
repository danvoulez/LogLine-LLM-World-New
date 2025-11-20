# Phase 1.5: Serverless Optimizations

This phase addresses critical Vercel Serverless constraints before implementing Phase 2 (AI SDK integration).

## Overview

Based on [CRITICAL_VERCEL_CONSIDERATIONS.md](./CRITICAL_VERCEL_CONSIDERATIONS.md), we need to:

1. ✅ **Add streaming support** (mandatory for long-running agents)
2. ✅ **Make workflows async** (avoid timeout issues)
3. ⚠️ **Evaluate Drizzle ORM** (better cold-start performance)
4. ✅ **Secure DB tools** (dry-run mode, SQL validation)

## Implementation Tasks

### Task 1: Add Streaming Endpoints

**Goal**: Enable real-time updates for long-running workflows via Server-Sent Events (SSE).

**Implementation**:

```typescript
// backend/src/runs/runs.controller.ts
@Get(':id/stream')
async streamRun(@Param('id') id: string, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection
  res.write(`data: ${JSON.stringify({ type: 'connected', runId: id })}\n\n`);

  // Poll for updates every 500ms
  const interval = setInterval(async () => {
    try {
      const run = await this.runsService.findOne(id);
      const events = await this.runsService.findEvents(id);

      res.write(`data: ${JSON.stringify({
        type: 'update',
        run: run,
        events: events.slice(-10), // Last 10 events
      })}\n\n`);

      // Close if completed
      if (run.status === 'completed' || run.status === 'failed') {
        clearInterval(interval);
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();
      }
    } catch (error) {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }, 500);

  // Cleanup on client disconnect
  res.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}
```

**Usage**:
```bash
curl -N http://localhost:3000/runs/{runId}/stream
```

---

### Task 2: Make Workflow Execution Async

**Goal**: Return immediately from `POST /workflows/:id/runs`, execute in background.

**Current Behavior**:
```typescript
// Blocks until workflow completes (can timeout!)
POST /workflows/:id/runs
→ Waits for entire workflow
→ Returns final result
```

**New Behavior**:
```typescript
// Returns immediately
POST /workflows/:id/runs
→ Creates run with status='pending'
→ Returns run_id immediately
→ Executes workflow in background

// Poll for status
GET /runs/:id
→ Check status: pending|running|completed|failed
```

**Implementation**:

```typescript
// backend/src/runs/runs.controller.ts
@Post('workflows/:id/runs')
async startRun(
  @Param('id') workflowId: string,
  @Body() createRunDto: CreateRunDto,
) {
  // Create run immediately
  const run = await this.runsService.create({
    workflow_id: workflowId,
    ...createRunDto,
    status: 'pending',
  });

  // Execute in background (non-blocking)
  this.orchestratorService.startRun(run.id).catch(error => {
    // Update run status to failed
    this.runsService.update(run.id, {
      status: 'failed',
      result: { error: error.message },
    });
  });

  // Return immediately
  return run;
}
```

**Background Execution**:

```typescript
// backend/src/execution/orchestrator.service.ts
async startRun(runId: string) {
  const run = await this.runsService.findOne(runId);
  
  // Update status to running
  await this.runsService.update(runId, { status: 'running' });

  try {
    // Execute workflow
    const result = await this.executeWorkflow(run);
    
    // Update status to completed
    await this.runsService.update(runId, {
      status: 'completed',
      result,
    });
  } catch (error) {
    await this.runsService.update(runId, {
      status: 'failed',
      result: { error: error.message },
    });
    throw error;
  }
}
```

**Note**: For production, consider using:
- **Vercel Cron** (check pending runs every minute)
- **Inngest** (event-driven step execution)
- **Upstash QStash** (queue-based execution)

---

### Task 3: Evaluate Drizzle ORM Migration

**Decision Point**: Should we migrate from TypeORM to Drizzle?

**Pros of Drizzle**:
- ✅ Faster cold starts (zero runtime dependencies)
- ✅ Smaller bundle size
- ✅ Better TypeScript inference
- ✅ Native Vercel Postgres support
- ✅ Simpler connection pooling

**Cons of Migration**:
- ⚠️ Requires rewriting all entities
- ⚠️ Requires updating all repositories
- ⚠️ Migration effort: ~2-3 days
- ⚠️ Current TypeORM setup works (just slower)

**Recommendation**: 
- **Phase 1.5**: Keep TypeORM, add performance monitoring
- **Phase 2**: If cold starts become an issue, migrate to Drizzle
- **Alternative**: Use Drizzle for new features, keep TypeORM for existing

**If Migrating**:

```typescript
// Install
npm install drizzle-orm drizzle-kit @vercel/postgres

// Schema definition
// backend/src/database/schema.ts
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-pgvector';

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: text('version').notNull().default('1.0.0'),
  definition: jsonb('definition').notNull(),
  type: text('type').notNull().default('linear'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// Query example
import { db } from './database';
import { eq } from 'drizzle-orm';

const workflow = await db
  .select()
  .from(workflows)
  .where(eq(workflows.id, workflowId))
  .limit(1);
```

---

### Task 4: Secure Natural Language DB Tools

**Goal**: Add dry-run mode and SQL validation (already documented in Phase 2 plan).

**Status**: ✅ Already updated in `PHASE2_AI_SDK_INTEGRATION.md`

**Key Features**:
- Dry-run mode by default
- SQL validation (block destructive operations)
- Explicit confirmation required
- Transaction support

---

## Implementation Order

1. **Task 2** (Async workflows) - Most critical for avoiding timeouts
2. **Task 1** (Streaming) - Enables real-time monitoring
3. **Task 4** (Security) - Already documented, implement with Phase 2
4. **Task 3** (Drizzle) - Evaluate after Phase 2 if needed

---

## Testing

### Test Async Execution
```bash
# Start workflow (returns immediately)
curl -X POST http://localhost:3000/workflows/{id}/runs \
  -H "Content-Type: application/json" \
  -d '{"input": {}, "mode": "auto"}'

# Response: {"id": "...", "status": "pending", ...}

# Poll for status
curl http://localhost:3000/runs/{runId}

# Stream updates
curl -N http://localhost:3000/runs/{runId}/stream
```

### Test Streaming
```bash
# Open SSE connection
curl -N http://localhost:3000/runs/{runId}/stream

# Should see:
# data: {"type":"connected","runId":"..."}
# data: {"type":"update","run":{...},"events":[...]}
# data: {"type":"complete"}
```

---

## Next Steps

After Phase 1.5:
- ✅ Workflows execute asynchronously (no timeout risk)
- ✅ Real-time updates via streaming
- ✅ Secure DB tools ready for Phase 2
- ⚠️ Drizzle migration evaluated (defer if not needed)

Then proceed to **Phase 2: AI SDK Integration**.

---

## References

- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Inngest](https://www.inngest.com/) (alternative to cron)

