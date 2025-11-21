import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MemoryModule } from './memory.module';
import { MemoryService } from './memory.service';
import { EmbeddingService } from './embedding.service';
import { MemoryItem } from './entities/memory-item.entity';
import { Resource } from './entities/resource.entity';
import { AgentRuntimeService } from '../agents/agent-runtime.service';
import { AgentsModule } from '../agents/agents.module';
import { ToolsModule } from '../tools/tools.module';
import { RunsModule } from '../runs/runs.module';

/**
 * Integration tests for Memory Engine with Agent Runtime
 * Tests the full flow: store → search → agent context injection
 */
describe('Memory Engine Integration', () => {
  let module: TestingModule;
  let memoryService: MemoryService;
  let embeddingService: EmbeddingService;
  let agentRuntimeService: AgentRuntimeService;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'logline_test',
          entities: [MemoryItem, Resource],
          synchronize: true, // Only for tests
          dropSchema: true, // Clean database for each test run
        }),
        MemoryModule,
        AgentsModule,
        ToolsModule,
        RunsModule,
      ],
    }).compile();

    memoryService = module.get<MemoryService>(MemoryService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
    agentRuntimeService = module.get<AgentRuntimeService>(AgentRuntimeService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.query('TRUNCATE TABLE resources CASCADE');
    await dataSource.query('TRUNCATE TABLE memory_items CASCADE');
  });

  describe('End-to-End: Memory → Agent Context Flow', () => {
    it('should store memories and retrieve them for agent context', async () => {
      const runId = 'run-test-123';
      const agentId = 'agent-test-123';
      const tenantId = 'tenant-test-123';

      // Step 1: Store multiple memories for the run
      const memory1 = await memoryService.storeMemory({
        owner_type: 'run',
        owner_id: runId,
        type: 'long_term',
        content: 'User prefers email notifications over SMS',
        metadata: { source: 'user_preference' },
        generateEmbedding: true,
      });

      const memory2 = await memoryService.storeMemory({
        owner_type: 'run',
        owner_id: runId,
        type: 'long_term',
        content: 'Previous ticket resolution: Issue was network connectivity, resolved by restarting router',
        metadata: { source: 'ticket_history' },
        generateEmbedding: true,
      });

      const memory3 = await memoryService.storeMemory({
        owner_type: 'agent',
        owner_id: agentId,
        type: 'long_term',
        content: 'Agent should always check network connectivity first when troubleshooting connectivity issues',
        metadata: { source: 'agent_knowledge' },
        generateEmbedding: true,
      });

      expect(memory1.id).toBeDefined();
      expect(memory2.id).toBeDefined();
      expect(memory3.id).toBeDefined();

      // Step 2: Search for relevant memories
      const searchResults = await memoryService.searchMemory({
        query: 'network connectivity issue troubleshooting',
        owner_type: 'run',
        owner_id: runId,
        limit: 5,
        threshold: 0.5, // Lower threshold for test
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].memory_id).toBeDefined();
      expect(searchResults[0].similarity).toBeGreaterThan(0);

      // Step 3: Verify memories are retrievable by owner
      const runMemories = await memoryService.retrieveMemory('run', runId);
      expect(runMemories.length).toBe(2);
      expect(runMemories.some((m) => m.id === memory1.id)).toBe(true);
      expect(runMemories.some((m) => m.id === memory2.id)).toBe(true);

      const agentMemories = await memoryService.retrieveMemory('agent', agentId);
      expect(agentMemories.length).toBe(1);
      expect(agentMemories[0].id).toBe(memory3.id);
    });

    it('should handle large content with automatic chunking', async () => {
      const largeContent = 'x'.repeat(5000); // > 4000 chars
      
      const memory = await memoryService.storeMemory({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'long_term',
        content: largeContent,
        generateEmbedding: true,
      });

      expect(memory.id).toBeDefined();
      
      // Verify resources were created for chunks
      const resources = await dataSource.query(
        'SELECT * FROM resources WHERE memory_item_id = $1',
        [memory.id],
      );
      
      expect(resources.length).toBeGreaterThan(1); // Should be chunked
      expect(resources[0].chunk_index).toBe(0);
      expect(resources[0].total_chunks).toBeGreaterThan(1);
    });

    it('should perform semantic search across different memory types', async () => {
      // Store memories of different types
      await memoryService.storeMemory({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'short_term',
        content: 'User is currently experiencing slow internet connection',
        generateEmbedding: true,
      });

      await memoryService.storeMemory({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'long_term',
        content: 'User has a history of network connectivity issues during peak hours',
        generateEmbedding: true,
      });

      await memoryService.storeMemory({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'profile',
        content: 'User works from home and relies heavily on stable internet connection',
        generateEmbedding: true,
      });

      // Search across all types
      const results = await memoryService.searchMemory({
        query: 'internet connection problems',
        owner_type: 'user',
        owner_id: 'user-123',
        limit: 10,
        threshold: 0.5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.type === 'short_term')).toBe(true);
      expect(results.some((r) => r.type === 'long_term')).toBe(true);
      expect(results.some((r) => r.type === 'profile')).toBe(true);
    });

    it('should update memory and regenerate embedding', async () => {
      const memory = await memoryService.storeMemory({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'long_term',
        content: 'Original content',
        generateEmbedding: true,
      });

      const originalEmbedding = memory.embedding;
      expect(originalEmbedding).toBeDefined();

      // Update content
      const updated = await memoryService.updateMemory(
        memory.id,
        'Updated content with more information',
        undefined,
        true, // Regenerate embedding
      );

      expect(updated.content).toBe('Updated content with more information');
      expect(updated.embedding).toBeDefined();
      // Embedding should be different (or at least regenerated)
      expect(updated.embedding).not.toEqual(originalEmbedding);
    });

    it('should delete memory and associated resources', async () => {
      const memory = await memoryService.storeMemory({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'long_term',
        content: 'Content to be deleted',
        generateEmbedding: true,
      });

      const memoryId = memory.id;

      // Verify memory exists
      const before = await memoryService.retrieveMemory('user', 'user-123');
      expect(before.some((m) => m.id === memoryId)).toBe(true);

      // Delete memory
      await memoryService.deleteMemory(memoryId);

      // Verify memory is deleted
      const after = await memoryService.retrieveMemory('user', 'user-123');
      expect(after.some((m) => m.id === memoryId)).toBe(false);

      // Verify resources are also deleted (CASCADE)
      const resources = await dataSource.query(
        'SELECT * FROM resources WHERE memory_item_id = $1',
        [memoryId],
      );
      expect(resources.length).toBe(0);
    });
  });

  describe('Performance: Semantic Search with Large Dataset', () => {
    it('should handle search across 100+ memories efficiently', async () => {
      const ownerId = 'perf-test-user';
      
      // Create 100 memories
      const promises = Array.from({ length: 100 }, (_, i) =>
        memoryService.storeMemory({
          owner_type: 'user',
          owner_id: ownerId,
          type: 'long_term',
          content: `Memory item ${i}: This is test content about topic ${i % 10}`,
          generateEmbedding: true,
        }),
      );

      await Promise.all(promises);

      // Perform search
      const startTime = Date.now();
      const results = await memoryService.searchMemory({
        query: 'test content topic',
        owner_type: 'user',
        owner_id: ownerId,
        limit: 10,
        threshold: 0.5,
      });
      const endTime = Date.now();

      expect(results.length).toBeLessThanOrEqual(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });

    it('should handle concurrent memory operations', async () => {
      const ownerId = 'concurrent-test-user';

      // Concurrent store operations
      const storePromises = Array.from({ length: 20 }, (_, i) =>
        memoryService.storeMemory({
          owner_type: 'user',
          owner_id: ownerId,
          type: 'long_term',
          content: `Concurrent memory ${i}`,
          generateEmbedding: true,
        }),
      );

      const memories = await Promise.all(storePromises);
      expect(memories.length).toBe(20);

      // Concurrent search operations
      const searchPromises = Array.from({ length: 10 }, () =>
        memoryService.searchMemory({
          query: 'concurrent memory',
          owner_type: 'user',
          owner_id: ownerId,
          limit: 5,
          threshold: 0.5,
        }),
      );

      const searchResults = await Promise.all(searchPromises);
      expect(searchResults.length).toBe(10);
      searchResults.forEach((results) => {
        expect(Array.isArray(results)).toBe(true);
      });
    });
  });
});

