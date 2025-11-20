# Critical Vercel Serverless Implementation Considerations

## A. The "Timeout" Problem (Long-Running Agents)

### Problem
Vercel Serverless functions have strict timeouts:
- **Hobby Plan**: 10 seconds
- **Pro Plan**: 60 seconds
- **Enterprise**: Longer

Complex agent loops (3+ tool calls + RAG) can easily exceed these limits.

### Solutions

#### 1. Streaming (Mandatory)
Use AI SDK's streaming to keep HTTP connection active:

```typescript
// Instead of waiting for complete response
const result = await generateText({...});

// Use streaming
const stream = await streamText({...});
// Stream chunks as they arrive
```

#### 2. Async Handoff Pattern
For long-running workflows:

```typescript
// Start workflow asynchronously
POST /workflows/:id/runs
→ Returns immediately with run_id
→ Workflow executes in background

// Poll for status
GET /runs/:id
→ Check status: pending|running|completed

// Or use Server-Sent Events
GET /runs/:id/stream
→ Real-time updates via SSE
```

#### 3. Step Runner with Cron/Queue
- **Vercel Cron**: Check for pending steps every minute
- **Inngest/Upstash QStash**: Trigger next step asynchronously
- **Database-driven**: Steps check DB for pending work

### Implementation Plan

1. ✅ Add streaming endpoints (`GET /runs/:id/stream`)
2. ⏳ Make workflow execution fully async (return immediately)
3. ⏳ Add step runner service (checks DB for pending steps)
4. ⏳ Integrate Vercel Cron or Inngest for async execution

---

## B. Database ORM Choice: TypeORM → Drizzle

### Problem
TypeORM has heavy cold-start times in serverless:
- Large bundle size
- Reflection overhead
- Connection pooling complexity

### Solution: Migrate to Drizzle ORM

**Benefits:**
- ✅ Zero runtime dependencies
- ✅ Faster cold starts
- ✅ Native Vercel Postgres support
- ✅ Better TypeScript inference
- ✅ Lighter bundle size

### Migration Plan

1. **Install Drizzle**:
   ```bash
   npm install drizzle-orm drizzle-kit @vercel/postgres
   ```

2. **Replace TypeORM entities** with Drizzle schemas
3. **Update repositories** to use Drizzle queries
4. **Keep same API surface** (controllers unchanged)

### Drizzle Schema Example

```typescript
// Instead of TypeORM entity
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

export const memoryItems = pgTable('memory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // pgvector support
  // ...
});
```

---

## C. Natural Language DB Tools (Security)

### Problem
Giving LLMs direct SQL access is **high risk**:
- SQL injection (even with validation)
- Cross-tenant data access
- Accidental data deletion
- Unauthorized modifications

### Solutions

#### 1. Dry Run Mode (Mandatory)

```typescript
// Natural Language DB Write Tool
async execute({ instruction, confirm, dryRun = true }) {
  // Generate SQL
  const sql = await generateSQL(instruction);
  
  // If dry run, return SQL without executing
  if (dryRun && !confirm) {
    return {
      dryRun: true,
      proposedSQL: sql,
      message: 'Review SQL and set confirm=true to execute',
      requiresConfirmation: true,
    };
  }
  
  // Only execute if explicitly confirmed
  if (!confirm) {
    throw new Error('Write operations require explicit confirmation');
  }
  
  // Execute with transaction
  // ...
}
```

#### 2. Row Level Security (RLS)

Enforce at **Postgres level**, not just application:

```sql
-- Enable RLS on tables
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY tenant_isolation ON runs
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set tenant context before queries
SET app.tenant_id = 'tenant-uuid';
```

#### 3. SQL Validation & Whitelisting

```typescript
// Only allow specific operations
const ALLOWED_OPERATIONS = ['INSERT', 'UPDATE'];
const BLOCKED_OPERATIONS = ['DELETE', 'DROP', 'TRUNCATE', 'ALTER'];

function validateSQL(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  
  // Block destructive operations
  if (BLOCKED_OPERATIONS.some(op => upper.startsWith(op))) {
    throw new Error(`Operation ${op} is not allowed`);
  }
  
  // Only allow safe operations
  if (!ALLOWED_OPERATIONS.some(op => upper.startsWith(op))) {
    throw new Error('Only INSERT and UPDATE operations allowed');
  }
  
  // Additional validation...
  return true;
}
```

#### 4. Separate Database Role

```sql
-- Create limited role for LLM connections
CREATE ROLE llm_app_role;

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE ON workflows TO llm_app_role;
GRANT SELECT, INSERT, UPDATE ON runs TO llm_app_role;
-- NO DELETE, DROP, ALTER permissions

-- Use this role for LLM database connections
SET ROLE llm_app_role;
```

### Implementation Priority

1. **High**: Dry run mode (implement immediately)
2. **High**: SQL validation (block destructive operations)
3. **Medium**: RLS policies (for Phase 4 multi-tenant)
4. **Medium**: Separate database role (for production)

---

## Implementation Roadmap

### Phase 1.5: Serverless Optimizations (Before Phase 2)

1. **Migrate to Drizzle ORM**
   - Replace TypeORM entities
   - Update repositories
   - Test performance improvement

2. **Add Streaming Support**
   - `GET /runs/:id/stream` endpoint
   - Server-Sent Events for real-time updates
   - Use AI SDK streaming for agents

3. **Make Workflows Async**
   - Return immediately from `POST /workflows/:id/runs`
   - Execute in background
   - Add status polling

4. **Add Security to DB Tools**
   - Dry run mode
   - SQL validation
   - Confirmation required

### Phase 2: Continue with AI SDK Integration
- After serverless optimizations are complete

---

## References

- [Drizzle ORM](https://orm.drizzle.team/)
- [Vercel Postgres with Drizzle](https://vercel.com/docs/storage/vercel-postgres)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [AI SDK Streaming](https://v5.ai-sdk.dev/docs/ai-sdk-core/generate-text)

---

**Status**: ⚠️ Critical considerations identified, implementation plan created

