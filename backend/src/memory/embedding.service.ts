import { Injectable, Logger } from '@nestjs/common';
import { embed, EmbeddingModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export interface EmbeddingConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
}

export interface EmbeddingResult {
  embedding: number[];
  dimension: number;
  model: string;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  /**
   * Generate embedding for a text using the specified provider
   */
  async generateEmbedding(
    text: string,
    config: EmbeddingConfig = { provider: 'openai', model: 'text-embedding-3-small' },
  ): Promise<EmbeddingResult> {
    try {
      const model = this.getEmbeddingModel(config);

      const { embedding } = await embed({
        model,
        value: text,
      });

      return {
        embedding: Array.from(embedding),
        dimension: embedding.length,
        model: config.model,
      };
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`, error.stack);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(
    texts: string[],
    config: EmbeddingConfig = { provider: 'openai', model: 'text-embedding-3-small' },
  ): Promise<EmbeddingResult[]> {
    try {
      const model = this.getEmbeddingModel(config);

      // Process in batches to avoid rate limits
      const batchSize = 10;
      const results: EmbeddingResult[] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map((text) =>
          embed({
            model,
            value: text,
          }),
        );

        const batchResults = await Promise.all(batchPromises);

        for (const { embedding } of batchResults) {
          results.push({
            embedding: Array.from(embedding),
            dimension: embedding.length,
            model: config.model,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to generate batch embeddings: ${error.message}`, error.stack);
      throw new Error(`Batch embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Get embedding model based on provider and model name
   */
  private getEmbeddingModel(config: EmbeddingConfig): EmbeddingModel {
    switch (config.provider) {
      case 'openai':
        // OpenAI embedding models
        if (config.model.startsWith('text-embedding-3-')) {
          return openai.embedding(config.model);
        }
        // Fallback to text-embedding-ada-002
        return openai.embedding('text-embedding-3-small');

      case 'anthropic':
        // Anthropic doesn't have dedicated embedding models yet
        // Use OpenAI as fallback
        this.logger.warn('Anthropic embedding not available, using OpenAI');
        return openai.embedding('text-embedding-3-small');

      case 'google':
        // Google embedding models
        if (config.model.includes('embedding')) {
          return google.embedding(config.model);
        }
        // Fallback
        return google.embedding('models/embedding-001');

      default:
        // Default to OpenAI
        return openai.embedding('text-embedding-3-small');
    }
  }

  /**
   * Get embedding dimension for a model
   */
  getEmbeddingDimension(config: EmbeddingConfig): number {
    switch (config.provider) {
      case 'openai':
        if (config.model === 'text-embedding-3-small') return 1536;
        if (config.model === 'text-embedding-3-large') return 3072;
        if (config.model === 'text-embedding-ada-002') return 1536;
        return 1536; // default

      case 'google':
        return 768; // Google embedding models typically use 768

      case 'anthropic':
        return 1536; // Fallback to OpenAI dimension

      default:
        return 1536;
    }
  }
}

