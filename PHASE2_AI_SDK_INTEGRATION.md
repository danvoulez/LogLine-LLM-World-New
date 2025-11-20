# Phase 2: Vercel AI SDK v5 Integration Plan

This document outlines how to integrate [Vercel AI SDK v5](https://v5.ai-sdk.dev/) and the natural language Postgres pattern into LogLine's Phase 2 implementation.

## Overview

The Vercel AI SDK v5 provides:
- **Unified API** for multiple LLM providers (OpenAI, Anthropic, Google, Mistral)
- **Streaming support** for real-time responses
- **Tool calling** (function calling) with automatic schema validation
- **Structured outputs** for reliable data extraction
- **Edge/Serverless ready** - perfect for Vercel deployment

This aligns perfectly with our **LLM Router** and **Agent Runtime** requirements.

## Architecture Integration

### 1. LLM Router Service

Replace direct provider calls with AI SDK's unified interface:

```typescript
// src/llm/llm-router.service.ts
import { openai, anthropic, google } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

@Injectable()
export class LlmRouterService {
  private getProvider(provider: string) {
    switch (provider) {
      case 'openai': return openai;
      case 'anthropic': return anthropic;
      case 'google': return google;
      default: return openai;
    }
  }

  async generateText(prompt: string, config: AgentConfig) {
    const model = this.getProvider(config.provider)(config.model);
    return generateText({
      model,
      prompt,
      tools: config.allowed_tools, // Tool schemas
      maxTokens: config.max_tokens,
    });
  }

  async streamText(prompt: string, config: AgentConfig) {
    const model = this.getProvider(config.provider)(config.model);
    return streamText({
      model,
      prompt,
      tools: config.allowed_tools,
    });
  }
}
```

**Benefits:**
- Single interface for all providers
- Automatic retry logic
- Rate limiting built-in
- Consistent error handling

### 2. Agent Runtime Service

Use AI SDK for agent execution with tool calling:

```typescript
// src/agents/agent-runtime.service.ts
import { generateText, tool } from 'ai';
import { z } from 'zod';

@Injectable()
export class AgentRuntimeService {
  constructor(
    private llmRouter: LlmRouterService,
    private toolRuntime: ToolRuntimeService,
  ) {}

  async runAgentStep(
    agent: Agent,
    context: AgentContext,
    tools: Tool[],
  ): Promise<AgentResult> {
    // Convert tools to AI SDK format
    const aiTools = tools.map(tool => 
      tool({
        description: tool.description,
        parameters: z.object(tool.input_schema),
        execute: async (params) => {
          // Call our tool runtime
          return await this.toolRuntime.callTool(tool.id, params);
        },
      })
    );

    // Build prompt from agent config
    const prompt = this.buildPrompt(agent, context);

    // Generate with tool calling
    const result = await generateText({
      model: this.llmRouter.getModel(agent.model_profile),
      prompt,
      tools: aiTools,
      maxSteps: 5, // Allow multi-turn tool calling
    });

    // Log tool calls as events
    for (const toolCall of result.toolCalls) {
      await this.logToolCall(context.runId, toolCall);
    }

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      finishReason: result.finishReason,
    };
  }
}
```

**Key Features:**
- Automatic tool calling loop
- Multi-step reasoning
- Tool call validation
- Streaming support for real-time updates

### 3. Natural Language Database Tool (Read & Write)

Inspired by the [Natural Language Postgres template](https://vercel.com/templates/next.js/natural-language-postgres), create a tool that allows agents to both **read** and **write** to the database using natural language:

```typescript
// src/tools/natural-language-db.tool.ts
import { tool } from 'ai';
import { z } from 'zod';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Injectable, InjectRepository } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { PolicyEngineService } from '../policies/policy-engine.service';

@Injectable()
export class NaturalLanguageDbTool {
  constructor(
    private dataSource: DataSource,
    private policyEngine: PolicyEngineService,
  ) {}

  async createReadTool() {
    return tool({
      description: 'Query the database using natural language. READ-ONLY operations. Converts your question to SQL SELECT queries.',
      parameters: z.object({
        query: z.string().describe('Your question about the data in natural language'),
      }),
      execute: async ({ query }, context) => {
        // Check policy before execution
        const allowed = await this.policyEngine.checkToolCall(
          'natural_language_db_read',
          context.runId,
          context.appId,
        );
        if (!allowed) {
          throw new Error('Policy denied: Database read access not allowed');
        }

        // Use AI to convert natural language to SQL
        const { text: sql } = await generateText({
          model: openai('gpt-4o'),
          prompt: `Convert this natural language query to PostgreSQL SQL SELECT statement:
          
Query: ${query}

Database schema:
- workflows (id, name, version, definition, type, created_at, updated_at)
- runs (id, workflow_id, status, mode, input, result, created_at)
- steps (id, run_id, node_id, type, status, input, output)
- events (id, run_id, step_id, kind, payload, ts)

IMPORTANT: 
- Only generate SELECT queries (READ operations)
- Never generate INSERT, UPDATE, DELETE, DROP, TRUNCATE, or ALTER
- Return ONLY the SQL query, no explanation`,
        });

        // Validate it's a SELECT query
        if (!sql.trim().toUpperCase().startsWith('SELECT')) {
          throw new Error('Security: Only SELECT queries are allowed for read operations');
        }

        // Execute SQL
        const results = await this.dataSource.query(sql);

        return {
          operation: 'read',
          sql,
          results,
          rowCount: results.length,
        };
      },
    });
  }

  async createWriteTool() {
    return tool({
      description: 'Modify the database using natural language. Supports INSERT, UPDATE operations. Requires policy approval.',
      parameters: z.object({
        instruction: z.string().describe('What you want to do with the data in natural language (e.g., "Create a new workflow named X", "Update workflow Y to version 2.0")'),
        confirm: z.boolean().optional().describe('Set to true to confirm this write operation'),
      }),
      execute: async ({ instruction, confirm }, context) => {
        // Check policy before execution
        const allowed = await this.policyEngine.checkToolCall(
          'natural_language_db_write',
          context.runId,
          context.appId,
        );
        if (!allowed) {
          throw new Error('Policy denied: Database write access not allowed');
        }

        // Require explicit confirmation for write operations
        if (!confirm) {
          return {
            operation: 'write',
            requiresConfirmation: true,
            proposedAction: instruction,
            message: 'Write operation requires explicit confirmation. Set confirm=true to proceed.',
          };
        }

        // Check if run is in draft mode (safer for writes)
        const run = await this.runsService.findOne(context.runId);
        if (run.mode === 'auto' && !context.allowAutoWrites) {
          throw new Error('Write operations in auto mode require explicit approval');
        }

        // Use AI to convert natural language to SQL
        const { text: sql } = await generateText({
          model: openai('gpt-4o'),
          prompt: `Convert this natural language instruction to PostgreSQL SQL:
          
Instruction: ${instruction}

Database schema:
- workflows (id UUID PRIMARY KEY, name VARCHAR, version VARCHAR, definition JSONB, type VARCHAR, created_at TIMESTAMP, updated_at TIMESTAMP)
- runs (id UUID PRIMARY KEY, workflow_id UUID, status VARCHAR, mode VARCHAR, input JSONB, result JSONB, created_at TIMESTAMP, updated_at TIMESTAMP)
- steps (id UUID PRIMARY KEY, run_id UUID, node_id VARCHAR, type VARCHAR, status VARCHAR, input JSONB, output JSONB, started_at TIMESTAMP, finished_at TIMESTAMP)
- events (id UUID PRIMARY KEY, run_id UUID, step_id UUID, kind VARCHAR, payload JSONB, ts TIMESTAMP)

IMPORTANT:
- For INSERT: Generate proper INSERT statements with all required fields
- For UPDATE: Generate UPDATE statements with WHERE clauses (be specific!)
- NEVER generate DELETE, DROP, TRUNCATE, or ALTER TABLE statements
- Use proper UUID format for IDs
- Return ONLY the SQL query, no explanation`,
        });

        // Validate it's a safe write operation
        const sqlUpper = sql.trim().toUpperCase();
        if (sqlUpper.startsWith('DELETE') || 
            sqlUpper.startsWith('DROP') || 
            sqlUpper.startsWith('TRUNCATE') ||
            sqlUpper.startsWith('ALTER')) {
          throw new Error('Security: Destructive operations (DELETE, DROP, TRUNCATE, ALTER) are not allowed');
        }

        if (!sqlUpper.startsWith('INSERT') && !sqlUpper.startsWith('UPDATE')) {
          throw new Error('Security: Only INSERT and UPDATE operations are allowed');
        }

        // Execute SQL in a transaction
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const results = await queryRunner.query(sql);
          await queryRunner.commitTransaction();

          return {
            operation: 'write',
            sql,
            affectedRows: results.rowCount || results.length,
            success: true,
          };
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw new Error(`Database write failed: ${error.message}`);
        } finally {
          await queryRunner.release();
        }
      },
    });
  }
}
```

**Read Use Cases:**
- "Show me all failed runs from last week"
- "What workflows have the most runs?"
- "Find runs that took longer than 5 seconds"
- "List all workflows created in the last month"

**Write Use Cases:**
- "Create a new workflow named 'Customer Onboarding' with a linear type"
- "Update workflow 'abc-123' to version 2.0"
- "Mark all pending runs as cancelled"
- "Create a new run for workflow 'xyz-789' with input data"

**Safety Features:**
- ✅ Policy engine checks before execution
- ✅ Read-only tool separate from write tool
- ✅ SQL validation (only SELECT for reads, only INSERT/UPDATE for writes)
- ✅ Transaction support for writes (rollback on error)
- ✅ Confirmation required for write operations
- ✅ Mode restrictions (auto mode requires extra approval)
- ✅ No destructive operations (DELETE, DROP, TRUNCATE, ALTER)

### 4. Streaming Support for Real-time Traces

Use AI SDK's streaming for live workflow execution:

```typescript
// src/runs/runs.controller.ts
@Get('runs/:id/stream')
async streamRun(@Param('id') id: string) {
  const run = await this.runsService.findOne(id);
  
  // Create streaming response
  return new Response(
    new ReadableStream({
      async start(controller) {
        // Stream agent responses in real-time
        const stream = await this.agentRuntime.streamAgentStep(...);
        
        for await (const chunk of stream.textStream) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    },
  );
}
```

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd backend
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod
```

### Step 2: Create LLM Router Module

```bash
nest g module llm
nest g service llm/llm-router
```

### Step 3: Create Agent Runtime Module

```bash
nest g module agents
nest g service agents/agent-runtime
```

### Step 4: Create Tool Runtime Module

```bash
nest g module tools
nest g service tools/tool-runtime
```

### Step 5: Update Orchestrator

Modify `orchestrator.service.ts` to use agent and tool runtime:

```typescript
case 'agent':
  output = await this.agentRuntime.runAgentStep(
    agentConfig,
    { runId, workflowId, input },
    availableTools,
  );
  break;

case 'tool':
  output = await this.toolRuntime.callTool(
    node.tool_id,
    node.input,
  );
  break;
```

## Database Schema Updates

Add tables for Phase 2:

```typescript
// src/agents/entities/agent.entity.ts
@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  instructions: string;

  @Column('jsonb')
  model_profile: {
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    temperature?: number;
    max_tokens?: number;
  };

  @Column('simple-array')
  allowed_tools: string[]; // Tool IDs
}

// src/tools/entities/tool.entity.ts
@Entity('tools')
export class Tool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('jsonb')
  input_schema: Record<string, any>; // JSON Schema

  @Column('jsonb')
  output_schema: Record<string, any>;

  @Column()
  handler_ref: string; // Reference to handler function

  @Column('simple-array')
  side_effects: string[]; // ['writes_db', 'sends_email']
}
```

## Benefits of AI SDK v5

1. **Provider Agnostic**: Switch between OpenAI, Anthropic, Google easily
2. **Type Safety**: Full TypeScript support with Zod schemas
3. **Streaming**: Real-time responses for better UX
4. **Tool Calling**: Built-in function calling with validation
5. **Structured Outputs**: Reliable data extraction
6. **Serverless Optimized**: Works perfectly with Vercel

## Example: Complete Agent Workflow

```typescript
// Agent executes with tool calling
const result = await agentRuntime.runAgentStep(agent, context, [
  naturalLanguageDbReadTool,  // Read from database
  naturalLanguageDbWriteTool,   // Write to database
  sendEmailTool,
  queryMemoryTool,
]);

// Agent can:
// 1. Query database: "Show me recent failed runs"
// 2. Analyze results
// 3. Write to database: "Create a new workflow named 'Alert System'"
// 4. Update data: "Mark all failed runs as reviewed"
// 5. Send email notification
// 6. Store insights in memory

// All tool calls are logged as events
// Full trace available via GET /runs/:id/events
```

## Natural Language Database Write: Safety Considerations

### Multi-Layer Protection

1. **Policy Engine**: Checks if agent/app has write permissions
2. **Mode Restrictions**: Auto mode requires extra approval
3. **SQL Validation**: Only allows INSERT/UPDATE, blocks DELETE/DROP/TRUNCATE/ALTER
4. **Confirmation Required**: Write operations need explicit `confirm: true`
5. **Transactions**: All writes wrapped in transactions (rollback on error)
6. **Schema Awareness**: AI is given full schema to generate correct SQL

### Example: Safe Write Flow

```typescript
// Agent wants to create a workflow
const result = await agentRuntime.runAgentStep(agent, context, [
  naturalLanguageDbWriteTool,
]);

// First call (without confirm) - returns confirmation request
// {
//   operation: 'write',
//   requiresConfirmation: true,
//   proposedAction: "Create a new workflow named 'Customer Onboarding'",
//   message: 'Write operation requires explicit confirmation...'
// }

// Agent confirms and retries with confirm: true
const confirmed = await agentRuntime.runAgentStep(agent, {
  ...context,
  toolCall: { ...previousCall, confirm: true },
}, [naturalLanguageDbWriteTool]);

// Executes: INSERT INTO workflows (name, type, ...) VALUES (...)
// Returns: { operation: 'write', sql: '...', affectedRows: 1, success: true }
```

### Policy Configuration Example

```typescript
// Policy: Allow writes only in draft mode
{
  id: 'db-write-policy',
  scope: 'app',
  rule: {
    condition: 'run.mode === "draft"',
    effect: 'allow',
  },
}

// Policy: Block destructive operations
{
  id: 'no-delete-policy',
  scope: 'global',
  rule: {
    condition: 'tool.name === "natural_language_db_write" && sql.includes("DELETE")',
    effect: 'deny',
  },
}
```

## References

- [Vercel AI SDK v5 Documentation](https://v5.ai-sdk.dev/)
- [Natural Language Postgres Template](https://vercel.com/templates/next.js/natural-language-postgres)
- [AI SDK RAG Agent Guide](https://ai-sdk.dev/llms.txt) - For Phase 4 Memory Engine
- [AI SDK GitHub](https://github.com/vercel/ai)
- [AI SDK v5 Workshop](https://www.youtube.com/watch?v=0h7rTMwpduA)

## Next Steps

1. Review this plan
2. Install AI SDK dependencies
3. Implement LLM Router service
4. Implement Agent Runtime service
5. Create natural language SQL tool
6. Update orchestrator to use new services
7. Add streaming endpoints for real-time traces

