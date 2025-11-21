import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryService } from './memory.service';
import { EmbeddingService } from './embedding.service';
import { MemoryItem } from './entities/memory-item.entity';
import { Resource } from './entities/resource.entity';

describe('MemoryService', () => {
  let service: MemoryService;
  let memoryRepository: Repository<MemoryItem>;
  let resourceRepository: Repository<Resource>;
  let embeddingService: EmbeddingService;

  const mockMemoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
  };

  const mockResourceRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
    generateEmbeddings: jest.fn(),
    getEmbeddingDimension: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: getRepositoryToken(MemoryItem),
          useValue: mockMemoryRepository,
        },
        {
          provide: getRepositoryToken(Resource),
          useValue: mockResourceRepository,
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    memoryRepository = module.get<Repository<MemoryItem>>(getRepositoryToken(MemoryItem));
    resourceRepository = module.get<Repository<Resource>>(getRepositoryToken(Resource));
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeMemory', () => {
    it('should store a memory item with embedding', async () => {
      const input = {
        owner_type: 'user' as const,
        owner_id: 'user-123',
        type: 'long_term' as const,
        content: 'Test memory content',
        generateEmbedding: true,
      };

      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        dimension: 1536,
        model: 'text-embedding-3-small',
      });

      const mockMemory = {
        id: 'memory-123',
        ...input,
        embedding: mockEmbedding,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockMemoryRepository.create.mockReturnValue(mockMemory);
      mockMemoryRepository.save.mockResolvedValue(mockMemory);

      const result = await service.storeMemory(input);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        input.content,
        expect.any(Object),
      );
      expect(mockMemoryRepository.create).toHaveBeenCalled();
      expect(mockMemoryRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockMemory);
    });

    it('should store memory without embedding if generateEmbedding is false', async () => {
      const input = {
        owner_type: 'user' as const,
        owner_id: 'user-123',
        type: 'short_term' as const,
        content: 'Test memory',
        generateEmbedding: false,
      };

      const mockMemory = {
        id: 'memory-123',
        ...input,
        embedding: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockMemoryRepository.create.mockReturnValue(mockMemory);
      mockMemoryRepository.save.mockResolvedValue(mockMemory);

      const result = await service.storeMemory(input);

      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
      expect(result.embedding).toBeNull();
    });

    it('should chunk large content and create resources', async () => {
      const largeContent = 'x'.repeat(5000); // > 4000 chars
      const input = {
        owner_type: 'user' as const,
        owner_id: 'user-123',
        type: 'long_term' as const,
        content: largeContent,
        generateEmbedding: true,
      };

      const mockEmbeddings = [
        { embedding: [0.1, 0.2], dimension: 1536 },
        { embedding: [0.3, 0.4], dimension: 1536 },
      ];

      mockEmbeddingService.generateEmbeddings.mockResolvedValue(mockEmbeddings);

      const mockMemory = {
        id: 'memory-123',
        owner_type: input.owner_type,
        owner_id: input.owner_id,
        type: input.type,
        content: largeContent.substring(0, 1000) + '...',
        metadata: { chunked: true, chunk_count: 2 },
        embedding: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockResources = [
        { id: 'resource-1', content: 'x'.repeat(4000), chunk_index: 0 },
        { id: 'resource-2', content: 'x'.repeat(1000), chunk_index: 1 },
      ];

      mockMemoryRepository.create.mockReturnValue(mockMemory);
      mockMemoryRepository.save.mockResolvedValue(mockMemory);
      mockResourceRepository.create.mockImplementation((data) => data);
      mockResourceRepository.save.mockImplementation((data) => Promise.resolve({ ...data, id: `resource-${data.chunk_index}` }));

      const result = await service.storeMemory(input);

      expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalled();
      expect(mockResourceRepository.create).toHaveBeenCalledTimes(2);
      expect(result.metadata?.chunked).toBe(true);
    });
  });

  describe('retrieveMemory', () => {
    it('should retrieve memories by owner', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          owner_type: 'user',
          owner_id: 'user-123',
          type: 'long_term',
          content: 'Memory 1',
          created_at: new Date(),
        },
        {
          id: 'memory-2',
          owner_type: 'user',
          owner_id: 'user-123',
          type: 'short_term',
          content: 'Memory 2',
          created_at: new Date(),
        },
      ];

      mockMemoryRepository.find.mockResolvedValue(mockMemories);

      const result = await service.retrieveMemory('user', 'user-123');

      expect(mockMemoryRepository.find).toHaveBeenCalledWith({
        where: { owner_type: 'user', owner_id: 'user-123' },
        order: { created_at: 'DESC' },
        take: 50,
        relations: ['resources'],
      });
      expect(result).toEqual(mockMemories);
    });

    it('should filter by type if provided', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          owner_type: 'user',
          owner_id: 'user-123',
          type: 'long_term',
          content: 'Memory 1',
          created_at: new Date(),
        },
      ];

      mockMemoryRepository.find.mockResolvedValue(mockMemories);

      const result = await service.retrieveMemory('user', 'user-123', 'long_term');

      expect(mockMemoryRepository.find).toHaveBeenCalledWith({
        where: { owner_type: 'user', owner_id: 'user-123', type: 'long_term' },
        order: { created_at: 'DESC' },
        take: 50,
        relations: ['resources'],
      });
      expect(result).toEqual(mockMemories);
    });
  });

  describe('searchMemory', () => {
    it('should perform semantic search', async () => {
      const query = 'test query';
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          id: 'memory-1',
          content: 'Test content',
          similarity: '0.85',
          type: 'long_term',
          metadata: null,
          created_at: new Date(),
        },
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        dimension: 1536,
        model: 'text-embedding-3-small',
      });

      mockMemoryRepository.query.mockResolvedValue(mockResults);

      const result = await service.searchMemory({
        query,
        limit: 10,
        threshold: 0.7,
      });

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        query,
        expect.any(Object),
      );
      expect(mockMemoryRepository.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].memory_id).toBe('memory-1');
      expect(result[0].similarity).toBe(0.85);
    });
  });

  describe('deleteMemory', () => {
    it('should delete a memory item', async () => {
      const memoryId = 'memory-123';
      const mockMemory = {
        id: memoryId,
        content: 'Test memory',
      };

      mockMemoryRepository.findOne.mockResolvedValue(mockMemory as MemoryItem);
      mockMemoryRepository.remove.mockResolvedValue(mockMemory as MemoryItem);

      await service.deleteMemory(memoryId);

      expect(mockMemoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: memoryId },
      });
      expect(mockMemoryRepository.remove).toHaveBeenCalledWith(mockMemory);
    });

    it('should throw NotFoundException if memory not found', async () => {
      mockMemoryRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteMemory('non-existent')).rejects.toThrow();
    });
  });

  describe('updateMemory', () => {
    it('should update memory content and regenerate embedding', async () => {
      const memoryId = 'memory-123';
      const newContent = 'Updated content';
      const mockMemory = {
        id: memoryId,
        content: 'Old content',
        metadata: {},
      };

      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        dimension: 1536,
        model: 'text-embedding-3-small',
      });

      mockMemoryRepository.findOne.mockResolvedValue(mockMemory as MemoryItem);
      mockMemoryRepository.save.mockResolvedValue({
        ...mockMemory,
        content: newContent,
        embedding: mockEmbedding,
      } as MemoryItem);

      const result = await service.updateMemory(memoryId, newContent, undefined, true);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        newContent,
        expect.any(Object),
      );
      expect(result.content).toBe(newContent);
      expect(result.embedding).toEqual(mockEmbedding);
    });
  });
});

