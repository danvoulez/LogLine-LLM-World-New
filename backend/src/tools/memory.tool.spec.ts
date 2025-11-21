import { Test, TestingModule } from '@nestjs/testing';
import { MemoryTool } from './memory.tool';
import { MemoryService } from '../memory/memory.service';
import { ToolContext } from './tool-runtime.service';

describe('MemoryTool', () => {
  let tool: MemoryTool;
  let memoryService: MemoryService;

  const mockMemoryService = {
    storeMemory: jest.fn(),
    retrieveMemory: jest.fn(),
    searchMemory: jest.fn(),
    deleteMemory: jest.fn(),
  };

  const mockContext: ToolContext = {
    runId: 'run-123',
    stepId: 'step-123',
    tenantId: 'tenant-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryTool,
        {
          provide: MemoryService,
          useValue: mockMemoryService,
        },
      ],
    }).compile();

    tool = module.get<MemoryTool>(MemoryTool);
    memoryService = module.get<MemoryService>(MemoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStoreTool', () => {
    it('should create store tool with correct schema', () => {
      const storeTool = tool.createStoreTool();

      expect(storeTool.id).toBe('memory.store');
      expect(storeTool.name).toBe('Store Memory');
      expect(storeTool.input_schema.properties.owner_type.enum).toContain('user');
      expect(storeTool.input_schema.properties.type.enum).toContain('long_term');
      expect(storeTool.input_schema.required).toContain('content');
    });

    it('should store memory when handler is called', async () => {
      const storeTool = tool.createStoreTool();
      const input = {
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'long_term',
        content: 'Test memory',
      };

      const mockMemory = {
        id: 'memory-123',
        created_at: new Date(),
      };

      mockMemoryService.storeMemory.mockResolvedValue(mockMemory);

      const result = await storeTool.handler(input, mockContext);

      expect(mockMemoryService.storeMemory).toHaveBeenCalledWith({
        owner_type: 'user',
        owner_id: 'user-123',
        type: 'long_term',
        content: 'Test memory',
        metadata: undefined,
        visibility: 'private',
        ttl: undefined,
        generateEmbedding: true,
      });
      expect(result.memory_id).toBe('memory-123');
      expect(result.stored_at).toBeDefined();
    });
  });

  describe('createRetrieveTool', () => {
    it('should retrieve memories when handler is called', async () => {
      const retrieveTool = tool.createRetrieveTool();
      const input = {
        owner_type: 'user',
        owner_id: 'user-123',
        limit: 10,
      };

      const mockMemories = [
        {
          id: 'memory-1',
          content: 'Memory 1',
          type: 'long_term',
          metadata: {},
          created_at: new Date(),
        },
        {
          id: 'memory-2',
          content: 'Memory 2',
          type: 'short_term',
          metadata: {},
          created_at: new Date(),
        },
      ];

      mockMemoryService.retrieveMemory.mockResolvedValue(mockMemories);

      const result = await retrieveTool.handler(input, mockContext);

      expect(mockMemoryService.retrieveMemory).toHaveBeenCalledWith(
        'user',
        'user-123',
        undefined,
        10,
      );
      expect(result.memories).toHaveLength(2);
      expect(result.memories[0].id).toBe('memory-1');
    });
  });

  describe('createSearchTool', () => {
    it('should search memories semantically', async () => {
      const searchTool = tool.createSearchTool();
      const input = {
        query: 'test query',
        limit: 5,
        threshold: 0.7,
      };

      const mockResults = [
        {
          memory_id: 'memory-1',
          content: 'Test content',
          similarity: 0.85,
          type: 'long_term',
          metadata: {},
          created_at: new Date(),
        },
      ];

      mockMemoryService.searchMemory.mockResolvedValue(mockResults);

      const result = await searchTool.handler(input, mockContext);

      expect(mockMemoryService.searchMemory).toHaveBeenCalledWith({
        query: 'test query',
        owner_type: undefined,
        owner_id: undefined,
        type: undefined,
        limit: 5,
        threshold: 0.7,
      });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].similarity).toBe(0.85);
    });
  });

  describe('createDeleteTool', () => {
    it('should delete memory when handler is called', async () => {
      const deleteTool = tool.createDeleteTool();
      const input = {
        memory_id: 'memory-123',
      };

      mockMemoryService.deleteMemory.mockResolvedValue(undefined);

      const result = await deleteTool.handler(input, mockContext);

      expect(mockMemoryService.deleteMemory).toHaveBeenCalledWith('memory-123');
      expect(result.deleted).toBe(true);
    });
  });

  describe('getAllTools', () => {
    it('should return all memory tools', () => {
      const tools = tool.getAllTools();

      expect(tools).toHaveLength(4);
      expect(tools.map((t) => t.id)).toEqual([
        'memory.store',
        'memory.retrieve',
        'memory.search',
        'memory.delete',
      ]);
    });
  });
});

