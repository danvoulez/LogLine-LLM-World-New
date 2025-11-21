import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { MemoryItem, MemoryOwnerType, MemoryType, MemoryVisibility } from './entities/memory-item.entity';
import { Resource } from './entities/resource.entity';
import { EmbeddingService, EmbeddingConfig } from './embedding.service';

export interface StoreMemoryInput {
  owner_type: MemoryOwnerType;
  owner_id: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, any>;
  visibility?: MemoryVisibility;
  ttl?: Date;
  generateEmbedding?: boolean;
  embeddingConfig?: EmbeddingConfig;
}

export interface SearchMemoryInput {
  query: string;
  owner_type?: MemoryOwnerType;
  owner_id?: string;
  type?: MemoryType;
  metadata?: Record<string, any>; // JSONB filter for metadata
  limit?: number;
  threshold?: number; // similarity threshold (0-1)
  embeddingConfig?: EmbeddingConfig;
}

export interface MemorySearchResult {
  memory_id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, any>;
  type: MemoryType;
  created_at: Date;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
    provider: 'openai',
    model: 'text-embedding-3-small',
  };

  constructor(
    @InjectRepository(MemoryItem)
    private memoryRepository: Repository<MemoryItem>,
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * Store a memory item with optional embedding generation
   */
  async storeMemory(input: StoreMemoryInput): Promise<MemoryItem> {
    const {
      owner_type,
      owner_id,
      type,
      content,
      metadata,
      visibility = 'private',
      ttl,
      generateEmbedding = true,
      embeddingConfig = this.DEFAULT_EMBEDDING_CONFIG,
    } = input;

    // Generate embedding if requested
    let embedding: number[] | null = null;
    if (generateEmbedding) {
      try {
        const embeddingResult = await this.embeddingService.generateEmbedding(content, embeddingConfig);
        embedding = embeddingResult.embedding;
      } catch (error) {
        this.logger.warn(`Failed to generate embedding for memory, storing without embedding: ${error.message}`);
      }
    }

    // Chunk large content (>1000 tokens ≈ 4000 chars) into resources
    const shouldChunk = content.length > 4000;
    let resources: Resource[] = [];

    if (shouldChunk) {
      // Simple chunking by size (can be improved with semantic chunking)
      const chunkSize = 4000;
      const chunks = this.chunkText(content, chunkSize);

      // Generate embeddings for chunks
      const chunkEmbeddings = await this.embeddingService.generateEmbeddings(
        chunks,
        embeddingConfig,
      );

      // Create memory item first (without embedding, will be set after)
      const memoryItem = this.memoryRepository.create({
        owner_type,
        owner_id,
        type,
        content: content.substring(0, 1000) + '...', // Store summary
        metadata: { ...metadata, chunked: true, chunk_count: chunks.length },
        embedding: null, // Main memory doesn't have embedding when chunked
        visibility,
        ttl,
      });

      const savedMemory = await this.memoryRepository.save(memoryItem);

      // Create resources for each chunk
      resources = await Promise.all(
        chunks.map((chunk, index) => {
          const resource = this.resourceRepository.create({
            name: `chunk_${index}`,
            content: chunk,
            metadata: { chunk_index: index, total_chunks: chunks.length },
            embedding: chunkEmbeddings[index].embedding,
            memory_item_id: savedMemory.id,
            chunk_index: index,
          });
          return this.resourceRepository.save(resource);
        }),
      );

      return savedMemory;
    } else {
      // Store as single memory item
      const memoryItem = this.memoryRepository.create({
        owner_type,
        owner_id,
        type,
        content,
        metadata,
        embedding,
        visibility,
        ttl,
      });

      return this.memoryRepository.save(memoryItem);
    }
  }

  /**
   * Retrieve memories by owner
   */
  async retrieveMemory(
    owner_type: MemoryOwnerType,
    owner_id: string,
    type?: MemoryType,
    limit: number = 50,
  ): Promise<MemoryItem[]> {
    const where: any = {
      owner_type,
      owner_id,
    };

    if (type) {
      where.type = type;
    }

    return this.memoryRepository.find({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      relations: ['resources'],
    });
  }

  /**
   * Semantic search across memories
   */
  async searchMemory(input: SearchMemoryInput): Promise<MemorySearchResult[]> {
    const {
      query,
      owner_type,
      owner_id,
      type,
      metadata,
      limit = 10,
      threshold = 0.7,
      embeddingConfig = this.DEFAULT_EMBEDDING_CONFIG,
    } = input;

    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query, embeddingConfig);

    // Build WHERE clause
    const whereConditions: string[] = ['embedding IS NOT NULL'];
    const params: any[] = [queryEmbedding.embedding];

    if (owner_type) {
      whereConditions.push(`owner_type = $${params.length + 1}`);
      params.push(owner_type);
    }

    if (owner_id) {
      whereConditions.push(`owner_id = $${params.length + 1}`);
      params.push(owner_id);
    }

    if (type) {
      whereConditions.push(`type = $${params.length + 1}`);
      params.push(type);
    }

    // Add metadata JSONB filter if provided
    if (metadata && Object.keys(metadata).length > 0) {
      whereConditions.push(`metadata @> $${params.length + 1}::jsonb`);
      params.push(JSON.stringify(metadata));
    }

    // Use pgvector cosine similarity
    const whereClause = whereConditions.join(' AND ');
    const similarityQuery = `
      SELECT 
        id,
        content,
        metadata,
        type,
        created_at,
        1 - (embedding <=> $1::vector) as similarity
      FROM memory_items
      WHERE ${whereClause}
        AND (1 - (embedding <=> $1::vector)) >= $${params.length + 1}
      ORDER BY embedding <=> $1::vector
      LIMIT $${params.length + 2}
    `;

    params.push(threshold);
    params.push(limit);

    const results = await this.memoryRepository.query(similarityQuery, params);

    return results.map((row: any) => ({
      memory_id: row.id,
      content: row.content,
      similarity: parseFloat(row.similarity),
      metadata: row.metadata,
      type: row.type,
      created_at: row.created_at,
    }));
  }

  /**
   * Delete a memory item with ownership validation
   */
  async deleteMemory(
    memoryId: string,
    owner_type: MemoryOwnerType,
    owner_id: string,
  ): Promise<void> {
    const memory = await this.memoryRepository.findOne({
      where: { id: memoryId, owner_type, owner_id },
    });
    if (!memory) {
      throw new NotFoundException(
        `Memory item ${memoryId} not found for owner ${owner_type}:${owner_id}`,
      );
    }

    await this.memoryRepository.remove(memory);
  }

  /**
   * Update a memory item
   */
  async updateMemory(
    memoryId: string,
    content?: string,
    metadata?: Record<string, any>,
    regenerateEmbedding: boolean = false,
    embeddingConfig: EmbeddingConfig = this.DEFAULT_EMBEDDING_CONFIG,
  ): Promise<MemoryItem> {
    const memory = await this.memoryRepository.findOne({ where: { id: memoryId } });
    if (!memory) {
      throw new NotFoundException(`Memory item ${memoryId} not found`);
    }

    if (content !== undefined) {
      memory.content = content;
    }

    if (metadata !== undefined) {
      memory.metadata = { ...memory.metadata, ...metadata };
    }

    // Regenerate embedding if requested
    if (regenerateEmbedding && content) {
      try {
        const embeddingResult = await this.embeddingService.generateEmbedding(content, embeddingConfig);
        memory.embedding = embeddingResult.embedding;
      } catch (error) {
        this.logger.warn(`Failed to regenerate embedding: ${error.message}`);
      }
    }

    return this.memoryRepository.save(memory);
  }

  /**
   * Clean up expired memories (TTL)
   */
  async cleanupExpiredMemories(): Promise<number> {
    const now = new Date();
    const result = await this.memoryRepository.delete({
      ttl: LessThan(now),
    });

    return result.affected || 0;
  }

  /**
   * Simple text chunking (can be improved with semantic chunking)
   */
  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      const chunk = text.substring(currentIndex, currentIndex + chunkSize);
      chunks.push(chunk);
      currentIndex += chunkSize;
    }

    return chunks;
  }
}

