# Phase 4: RAG Memory Engine Integration

Integration plan for implementing the Memory Engine with RAG capabilities using the [AI SDK RAG Agent guide](https://ai-sdk.dev/llms.txt).

## Overview

The blueprint's **Memory Engine** requires:
- ✅ Write/read memory items
- ✅ Embedding + retrieval
- ✅ Tools for RAG queries
- ✅ Integration into workflows for RAG flows

The [AI SDK RAG guide](https://ai-sdk.dev/llms.txt) provides the perfect pattern for this.

## Architecture

### Memory Engine Components

```
Memory Engine
├── Memory Storage (Postgres + pgvector)
├── Embedding Service (AI SDK embeddings)
├── Retrieval Service (semantic search)
└── Memory Tools (for agents)
```

## Database Schema

### Memory Items Table (with pgvector)

```typescript
// src/memory/entities/memory-item.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Vector } from 'pgvector';

@Entity('memory_items')
@Index(['owner_type', 'owner_id'])
export class MemoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['user', 'tenant', 'app', 'agent', 'run'],
  })
  owner_type: 'user' | 'tenant' | 'app' | 'agent' | 'run';

  @Column({ type: 'uuid' })
  owner_id: string;

  @Column({
    type: 'enum',
    enum: ['short_term', 'long_term', 'profile'],
  })
  type: 'short_term' | 'long_term' | 'profile';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // pgvector embedding column
  @Column({
    type: 'vector',
    length: 1536, // OpenAI embedding dimension
    nullable: true,
  })
  embedding: Vector | null;

  @Column({ type: 'varchar', length: 50, default: 'private' })
  visibility: string;

  @Column({ type: 'timestamp', nullable: true })
  ttl: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
```

### Resources Table (for Chunked Content)

Based on the [RAG guide](https://ai-sdk.dev/llms.txt), we'll also need a resources table for storing chunked source material:

```typescript
// src/memory/entities/resource.entity.ts
@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({
    type: 'vector',
    length: 1536,
    nullable: true,
  })
  embedding: Vector | null;

  @Column({ type: 'uuid', nullable: true })
  memory_item_id: string; // Link to memory item if needed

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

## Memory Engine Service

```typescript
// src/memory/memory-engine.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { MemoryItem } from './entities/memory-item.entity';
import { Resource } from './entities/resource.entity';

@Injectable()
export class MemoryEngineService {
  constructor(
    @InjectRepository(MemoryItem)
    private memoryRepo: Repository<MemoryItem>,
    @InjectRepository(Resource)
    private resourceRepo: Repository<Resource>,
  ) {}

  /**
   * Store a memory item with automatic embedding
   */
  async storeMemory(
    ownerType: string,
    ownerId: string,
    content: string,
    type: 'short_term' | 'long_term' | 'profile',
    metadata?: Record<string, any>,
  ): Promise<MemoryItem> {
    // Generate embedding
    const { embedding: embeddingVector } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: content,
    });

    // Store memory item
    const memory = this.memoryRepo.create({
      owner_type: ownerType as any,
      owner_id: ownerId,
      type,
      content,
      metadata,
      embedding: embeddingVector as any,
      visibility: 'private',
    });

    return this.memoryRepo.save(memory);
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieveMemories(
    query: string,
    ownerType?: string,
    ownerId?: string,
    limit: number = 5,
  ): Promise<MemoryItem[]> {
    // Generate query embedding
    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query,
    });

    // Build query with pgvector cosine similarity
    const queryBuilder = this.memoryRepo
      .createQueryBuilder('memory')
      .where('memory.embedding IS NOT NULL')
      .orderBy(
        `memory.embedding <=> :queryEmbedding::vector`,
        'ASC',
      )
      .setParameter('queryEmbedding', `[${queryEmbedding.join(',')}]`)
      .limit(limit);

    // Filter by owner if provided
    if (ownerType && ownerId) {
      queryBuilder
        .andWhere('memory.owner_type = :ownerType', { ownerType })
        .andWhere('memory.owner_id = :ownerId', { ownerId });
    }

    return queryBuilder.getMany();
  }

  /**
   * Store and chunk a resource (for RAG workflows)
   */
  async storeResource(
    name: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<Resource[]> {
    // Chunk content by sentences (simple approach)
    const chunks = this.chunkContent(content);

    // Generate embeddings for all chunks at once
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: chunks,
    });

    // Store chunks as resources
    const resources = chunks.map((chunk, index) =>
      this.resourceRepo.create({
        name: `${name} - Chunk ${index + 1}`,
        content: chunk,
        metadata: {
          ...metadata,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
        embedding: embeddings[index] as any,
      }),
    );

    return this.resourceRepo.save(resources);
  }

  /**
   * Retrieve relevant resources for RAG
   */
  async retrieveResources(
    query: string,
    limit: number = 5,
  ): Promise<Resource[]> {
    // Generate query embedding
    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query,
    });

    // Semantic search using cosine similarity
    return this.resourceRepo
      .createQueryBuilder('resource')
      .where('resource.embedding IS NOT NULL')
      .orderBy(
        `resource.embedding <=> :queryEmbedding::vector`,
        'ASC',
      )
      .setParameter('queryEmbedding', `[${queryEmbedding.join(',')}]`)
      .limit(limit)
      .getMany();
  }

  /**
   * Simple chunking by sentences
   * (Can be enhanced with more sophisticated chunking strategies)
   */
  private chunkContent(content: string, maxChunkSize: number = 500): string[] {
    const sentences = content.split(/[.!?]+\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
```

## Memory Tools for Agents

```typescript
// src/memory/memory-tools.service.ts
import { Injectable } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { MemoryEngineService } from './memory-engine.service';

@Injectable()
export class MemoryToolsService {
  constructor(private memoryEngine: MemoryEngineService) {}

  /**
   * Tool for agents to store memories
   */
  createStoreMemoryTool(context: { runId: string; agentId?: string }) {
    return tool({
      description: 'Store information in memory for later retrieval. Useful for remembering user preferences, conversation context, or important facts.',
      parameters: z.object({
        content: z.string().describe('The information to remember'),
        type: z.enum(['short_term', 'long_term', 'profile']).describe('Type of memory: short_term (temporary), long_term (persistent), profile (user profile data)'),
        metadata: z.record(z.any()).optional().describe('Optional metadata to store with the memory'),
      }),
      execute: async ({ content, type, metadata }) => {
        const memory = await this.memoryEngine.storeMemory(
          'run',
          context.runId,
          content,
          type,
          metadata,
        );

        return {
          success: true,
          memoryId: memory.id,
          message: `Stored ${type} memory`,
        };
      },
    });
  }

  /**
   * Tool for agents to retrieve memories
   */
  createRetrieveMemoryTool(context: { runId: string; agentId?: string }) {
    return tool({
      description: 'Search and retrieve relevant memories using semantic search. Finds memories similar to your query.',
      parameters: z.object({
        query: z.string().describe('What you want to remember or find (in natural language)'),
        limit: z.number().optional().default(5).describe('Maximum number of memories to retrieve'),
      }),
      execute: async ({ query, limit }) => {
        const memories = await this.memoryEngine.retrieveMemories(
          query,
          'run',
          context.runId,
          limit,
        );

        return {
          memories: memories.map(m => ({
            id: m.id,
            content: m.content,
            type: m.type,
            metadata: m.metadata,
            createdAt: m.created_at,
          })),
          count: memories.length,
        };
      },
    });
  }

  /**
   * Tool for agents to query knowledge base (RAG)
   */
  createQueryKnowledgeBaseTool() {
    return tool({
      description: 'Query the knowledge base using RAG (Retrieval-Augmented Generation). Finds relevant information from stored resources.',
      parameters: z.object({
        query: z.string().describe('Your question or what you want to know'),
        limit: z.number().optional().default(5).describe('Maximum number of resources to retrieve'),
      }),
      execute: async ({ query, limit }) => {
        const resources = await this.memoryEngine.retrieveResources(query, limit);

        return {
          resources: resources.map(r => ({
            id: r.id,
            name: r.name,
            content: r.content,
            metadata: r.metadata,
          })),
          count: resources.length,
          context: resources.map(r => r.content).join('\n\n'),
        };
      },
    });
  }
}
```

## RAG Workflow Integration

### Example: RAG-enabled Agent Workflow

```typescript
// src/agents/agent-runtime.service.ts (updated)
async runAgentStepWithRAG(
  agent: Agent,
  context: AgentContext,
  tools: Tool[],
): Promise<AgentResult> {
  // Retrieve relevant context from memory/knowledge base
  const memoryContext = await this.memoryEngine.retrieveMemories(
    context.userQuery || '',
    'run',
    context.runId,
    3,
  );

  // Retrieve relevant resources for RAG
  const ragContext = await this.memoryEngine.retrieveResources(
    context.userQuery || '',
    5,
  );

  // Build prompt with RAG context
  const prompt = this.buildPrompt(agent, context, {
    memories: memoryContext.map(m => m.content),
    ragContext: ragContext.map(r => r.content),
  });

  // Run agent with memory tools
  const result = await generateText({
    model: this.llmRouter.getModel(agent.model_profile),
    prompt,
    tools: {
      ...tools,
      storeMemory: this.memoryTools.createStoreMemoryTool(context),
      retrieveMemory: this.memoryTools.createRetrieveMemoryTool(context),
      queryKnowledgeBase: this.memoryTools.createQueryKnowledgeBaseTool(),
    },
    maxSteps: 5,
  });

  return result;
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install ai @ai-sdk/openai pgvector
npm install --save-dev @types/pgvector
```

### 2. Enable pgvector Extension

```sql
-- Run this in your Postgres database
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Update TypeORM Configuration

```typescript
// src/app.module.ts
TypeOrmModule.forRoot({
  // ... existing config
  extra: {
    // Enable pgvector support
    options: '--application_name=logline',
  },
}),
```

### 4. Create Migration

```typescript
// migrations/XXXXX-add-memory-vector.ts
export class AddMemoryVector1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');

    // Add embedding column to memory_items
    await queryRunner.query(`
      ALTER TABLE memory_items 
      ADD COLUMN embedding vector(1536)
    `);

    // Add index for vector similarity search
    await queryRunner.query(`
      CREATE INDEX memory_items_embedding_idx 
      ON memory_items 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);

    // Create resources table
    await queryRunner.query(`
      CREATE TABLE resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        embedding vector(1536),
        memory_item_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX resources_embedding_idx 
      ON resources 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS resources');
    await queryRunner.query('ALTER TABLE memory_items DROP COLUMN embedding');
  }
}
```

## Use Cases

### 1. Conversation Memory
```typescript
// Agent remembers user preferences
await memoryEngine.storeMemory(
  'user',
  userId,
  'User prefers dark mode and notifications disabled',
  'profile',
);
```

### 2. RAG Knowledge Base
```typescript
// Store documentation as resources
await memoryEngine.storeResource(
  'API Documentation',
  'Full API documentation content...',
  { source: 'docs', version: '1.0' },
);

// Agent queries knowledge base
const context = await memoryEngine.retrieveResources(
  'How do I create a workflow?',
);
```

### 3. Workflow Context
```typescript
// Store workflow execution context
await memoryEngine.storeMemory(
  'run',
  runId,
  'Workflow failed at step 3 due to timeout',
  'short_term',
  { workflowId, stepId: 'step-3' },
);
```

## References

- [AI SDK RAG Agent Guide](https://ai-sdk.dev/llms.txt)
- [AI SDK Embeddings Documentation](https://ai-sdk.dev/docs/ai-sdk-core/embeddings)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Vercel Postgres with pgvector](https://vercel.com/docs/storage/vercel-postgres)

## Benefits

1. ✅ **Semantic Search**: Find memories by meaning, not exact keywords
2. ✅ **RAG Integration**: Agents can access knowledge base during workflows
3. ✅ **Multi-owner Support**: Memories for users, agents, apps, runs
4. ✅ **Automatic Embeddings**: AI SDK handles embedding generation
5. ✅ **Postgres Native**: Uses pgvector (works with Vercel Postgres)
6. ✅ **Type-safe**: Full TypeScript support

This implementation follows the blueprint's Memory Engine requirements and uses the proven RAG pattern from the AI SDK guide.

