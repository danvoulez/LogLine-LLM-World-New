import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Mock the AI SDK
jest.mock('ai', () => ({
  embed: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: jest.fn((model) => ({ model, provider: 'openai' })),
  },
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const text = 'Test text';
      const mockEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      
      (embed as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      });

      const result = await service.generateEmbedding(text);

      expect(embed).toHaveBeenCalled();
      expect(result.embedding).toEqual(Array.from(mockEmbedding));
      expect(result.dimension).toBe(mockEmbedding.length);
    });

    it('should use default OpenAI config if not provided', async () => {
      const text = 'Test text';
      const mockEmbedding = new Float32Array([0.1, 0.2]);
      
      (embed as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      });

      await service.generateEmbedding(text);

      expect(embed).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Object),
          value: text,
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      const text = 'Test text';
      (embed as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(service.generateEmbedding(text)).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts in batches', async () => {
      const texts = Array.from({ length: 15 }, (_, i) => `Text ${i}`);
      const mockEmbedding = new Float32Array([0.1, 0.2]);

      (embed as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      });

      const result = await service.generateEmbeddings(texts);

      expect(result).toHaveLength(15);
      expect(embed).toHaveBeenCalledTimes(15);
    });

    it('should process in batches of 10', async () => {
      const texts = Array.from({ length: 25 }, (_, i) => `Text ${i}`);
      const mockEmbedding = new Float32Array([0.1, 0.2]);

      (embed as jest.Mock).mockResolvedValue({
        embedding: mockEmbedding,
      });

      await service.generateEmbeddings(texts);

      // Should be called 25 times (3 batches: 10 + 10 + 5)
      expect(embed).toHaveBeenCalledTimes(25);
    });
  });

  describe('getEmbeddingDimension', () => {
    it('should return correct dimension for OpenAI models', () => {
      expect(service.getEmbeddingDimension({ provider: 'openai', model: 'text-embedding-3-small' })).toBe(1536);
      expect(service.getEmbeddingDimension({ provider: 'openai', model: 'text-embedding-3-large' })).toBe(3072);
      expect(service.getEmbeddingDimension({ provider: 'openai', model: 'text-embedding-ada-002' })).toBe(1536);
    });

    it('should return correct dimension for Google models', () => {
      expect(service.getEmbeddingDimension({ provider: 'google', model: 'models/embedding-001' })).toBe(768);
    });

    it('should default to 1536 for unknown providers', () => {
      expect(service.getEmbeddingDimension({ provider: 'anthropic' as any, model: 'unknown' })).toBe(1536);
    });
  });
});

