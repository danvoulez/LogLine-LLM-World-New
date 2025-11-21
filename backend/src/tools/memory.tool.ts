import { Injectable } from '@nestjs/common';
import { ToolContext } from './tool-runtime.service';
import { MemoryService } from '../memory/memory.service';
import { MemoryOwnerType, MemoryType, MemoryVisibility } from '../memory/entities/memory-item.entity';

@Injectable()
export class MemoryTool {
  constructor(private memoryService: MemoryService) {}

  /**
   * Create memory store tool
   */
  createStoreTool() {
    return {
      id: 'memory.store',
      name: 'Store Memory',
      description: 'Store a memory item for later retrieval. Memories can be short-term, long-term, or profile information.',
      input_schema: {
        type: 'object',
        properties: {
          owner_type: {
            type: 'string',
            enum: ['user', 'tenant', 'app', 'agent', 'run'],
            description: 'Type of owner (user, tenant, app, agent, or run)',
          },
          owner_id: {
            type: 'string',
            description: 'ID of the owner',
          },
          type: {
            type: 'string',
            enum: ['short_term', 'long_term', 'profile'],
            description: 'Type of memory: short_term (temporary), long_term (persistent), or profile (user/agent profile)',
          },
          content: {
            type: 'string',
            description: 'Content to store in memory',
          },
          metadata: {
            type: 'object',
            description: 'Optional metadata to attach to the memory',
            additionalProperties: true,
          },
          visibility: {
            type: 'string',
            enum: ['private', 'org', 'public'],
            description: 'Visibility level: private (only owner), org (organization), or public',
            default: 'private',
          },
          ttl: {
            type: 'string',
            format: 'date-time',
            description: 'Optional time-to-live (expiration date) for the memory',
          },
        },
        required: ['owner_type', 'owner_id', 'type', 'content'],
      },
      output_schema: {
        type: 'object',
        properties: {
          memory_id: { type: 'string' },
          stored_at: { type: 'string', format: 'date-time' },
        },
      },
      handler: async (input: any, context: ToolContext) => {
        // Validate and enforce tenant/user/app ownership
        let finalOwnerId = input.owner_id;
        if (input.owner_type === 'tenant') {
          // Force tenant_id from context
          finalOwnerId = context.tenantId;
        } else if (input.owner_type === 'user') {
          // CRITICAL SECURITY: Require userId in context
          if (!context.userId) {
            throw new Error('Cannot use owner_type=user without userId in context');
          }
          finalOwnerId = context.userId;
        } else if (input.owner_type === 'app' && context.appId) {
          // Validate app_id matches context
          if (input.owner_id !== context.appId) {
            throw new Error(`App ID mismatch: cannot store memory for app ${input.owner_id} from context app ${context.appId}`);
          }
          finalOwnerId = context.appId;
        }

        const result = await this.memoryService.storeMemory({
          owner_type: input.owner_type as MemoryOwnerType,
          owner_id: finalOwnerId,
          type: input.type as MemoryType,
          content: input.content,
          metadata: input.metadata,
          visibility: (input.visibility as MemoryVisibility) || 'private',
          ttl: input.ttl ? new Date(input.ttl) : undefined,
          generateEmbedding: true,
        });

        return {
          memory_id: result.id,
          stored_at: result.created_at.toISOString(),
        };
      },
    };
  }

  /**
   * Create memory retrieve tool
   */
  createRetrieveTool() {
    return {
      id: 'memory.retrieve',
      name: 'Retrieve Memory',
      description: 'Retrieve memories by owner. Returns memories sorted by most recent first.',
      input_schema: {
        type: 'object',
        properties: {
          owner_type: {
            type: 'string',
            enum: ['user', 'tenant', 'app', 'agent', 'run'],
            description: 'Type of owner',
          },
          owner_id: {
            type: 'string',
            description: 'ID of the owner',
          },
          type: {
            type: 'string',
            enum: ['short_term', 'long_term', 'profile'],
            description: 'Optional: filter by memory type',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of memories to retrieve',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['owner_type', 'owner_id'],
      },
      output_schema: {
        type: 'object',
        properties: {
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                type: { type: 'string' },
                metadata: { type: 'object' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      handler: async (input: any, context: ToolContext) => {
        // Validate and enforce tenant/user/app ownership
        let finalOwnerId = input.owner_id;
        if (input.owner_type === 'tenant') {
          // Force tenant_id from context
          finalOwnerId = context.tenantId;
        } else if (input.owner_type === 'user') {
          // CRITICAL SECURITY: Require userId in context
          if (!context.userId) {
            throw new Error('Cannot use owner_type=user without userId in context');
          }
          finalOwnerId = context.userId;
        } else if (input.owner_type === 'app' && context.appId) {
          // Validate app_id matches context
          if (input.owner_id !== context.appId) {
            throw new Error(`App ID mismatch: cannot retrieve memory for app ${input.owner_id} from context app ${context.appId}`);
          }
          finalOwnerId = context.appId;
        }

        const memories = await this.memoryService.retrieveMemory(
          input.owner_type as MemoryOwnerType,
          finalOwnerId,
          input.type as MemoryType | undefined,
          input.limit || 50,
        );

        return {
          memories: memories.map((m) => ({
            id: m.id,
            content: m.content,
            type: m.type,
            metadata: m.metadata,
            created_at: m.created_at.toISOString(),
          })),
        };
      },
    };
  }

  /**
   * Create memory search tool (semantic search)
   */
  createSearchTool() {
    return {
      id: 'memory.search',
      name: 'Search Memory',
      description: 'Semantically search memories using natural language. Returns memories ranked by similarity to the query.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language query to search for',
          },
          owner_type: {
            type: 'string',
            enum: ['user', 'tenant', 'app', 'agent', 'run'],
            description: 'Optional: filter by owner type',
          },
          owner_id: {
            type: 'string',
            description: 'Optional: filter by owner ID',
          },
          type: {
            type: 'string',
            enum: ['short_term', 'long_term', 'profile'],
            description: 'Optional: filter by memory type',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10,
            minimum: 1,
            maximum: 50,
          },
          threshold: {
            type: 'number',
            description: 'Minimum similarity threshold (0-1). Higher = more strict.',
            default: 0.7,
            minimum: 0,
            maximum: 1,
          },
        },
        required: ['query'],
      },
      output_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                memory_id: { type: 'string' },
                content: { type: 'string' },
                similarity: { type: 'number' },
                metadata: { type: 'object' },
                type: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      handler: async (input: any, context: ToolContext) => {
        // CRITICAL SECURITY: Default safe - prevent cross-tenant global search
        let finalOwnerType: MemoryOwnerType;
        let finalOwnerId: string;

        if (input.owner_type === 'tenant') {
          // Force tenant_id from context
          if (!context.tenantId) {
            throw new Error('Cannot use owner_type=tenant without tenantId in context');
          }
          finalOwnerType = 'tenant';
          finalOwnerId = context.tenantId;
        } else if (input.owner_type === 'user') {
          // CRITICAL SECURITY: Require userId in context
          if (!context.userId) {
            throw new Error('Cannot use owner_type=user without userId in context');
          }
          finalOwnerType = 'user';
          finalOwnerId = context.userId;
        } else if (input.owner_type === 'app') {
          // Validate app_id matches context
          if (!context.appId) {
            throw new Error('Cannot use owner_type=app without appId in context');
          }
          if (input.owner_id && input.owner_id !== context.appId) {
            throw new Error(`App ID mismatch: cannot search memory for app ${input.owner_id} from context app ${context.appId}`);
          }
          finalOwnerType = 'app';
          finalOwnerId = context.appId;
        } else if (!input.owner_type) {
          // DEFAULT SAFE: If no owner_type specified, default to tenant from context
          if (!context.tenantId) {
            throw new Error('owner_type required or tenantId must be in context');
          }
          finalOwnerType = 'tenant';
          finalOwnerId = context.tenantId;
        } else {
          // For agent/run, require explicit owner_id
          if (!input.owner_id) {
            throw new Error(`owner_id required for owner_type=${input.owner_type}`);
          }
          finalOwnerType = input.owner_type as MemoryOwnerType;
          finalOwnerId = input.owner_id;
        }

        const results = await this.memoryService.searchMemory({
          query: input.query,
          owner_type: finalOwnerType,
          owner_id: finalOwnerId,
          type: input.type as MemoryType | undefined,
          limit: input.limit || 10,
          threshold: input.threshold || 0.7,
        });

        return {
          results: results.map((r) => ({
            memory_id: r.memory_id,
            content: r.content,
            similarity: r.similarity,
            metadata: r.metadata,
            type: r.type,
            created_at: r.created_at.toISOString(),
          })),
        };
      },
    };
  }

  /**
   * Create memory delete tool
   */
  createDeleteTool() {
    return {
      id: 'memory.delete',
      name: 'Delete Memory',
      description: 'Delete a memory item by ID.',
      input_schema: {
        type: 'object',
        properties: {
          memory_id: {
            type: 'string',
            description: 'ID of the memory item to delete',
          },
          owner_type: {
            type: 'string',
            enum: ['user', 'tenant', 'app', 'agent', 'run'],
            description: 'Optional: Type of owner. If not provided, defaults to tenant from context.',
          },
          owner_id: {
            type: 'string',
            description: 'Optional: ID of the owner (required for agent/run owner_type)',
          },
        },
        required: ['memory_id'],
      },
      output_schema: {
        type: 'object',
        properties: {
          deleted: { type: 'boolean' },
        },
      },
      handler: async (input: any, context: ToolContext) => {
        // CRITICAL SECURITY: Enforce ownership validation
        // Determine owner_type and owner_id from context (default to tenant for safety)
        let ownerType: MemoryOwnerType;
        let ownerId: string;

        if (input.owner_type) {
          ownerType = input.owner_type as MemoryOwnerType;
          if (ownerType === 'tenant') {
            if (!context.tenantId) {
              throw new Error('Cannot delete tenant memory without tenantId in context');
            }
            ownerId = context.tenantId;
          } else if (ownerType === 'user') {
            if (!context.userId) {
              throw new Error('Cannot delete user memory without userId in context');
            }
            ownerId = context.userId;
          } else if (ownerType === 'app') {
            if (!context.appId) {
              throw new Error('Cannot delete app memory without appId in context');
            }
            ownerId = context.appId;
          } else {
            // For agent/run, require explicit owner_id
            if (!input.owner_id) {
              throw new Error(`owner_id required for owner_type=${ownerType}`);
            }
            ownerId = input.owner_id;
          }
        } else {
          // Default safe: use tenant from context
          if (!context.tenantId) {
            throw new Error('owner_type required or tenantId must be in context');
          }
          ownerType = 'tenant';
          ownerId = context.tenantId;
        }

        await this.memoryService.deleteMemory(input.memory_id, ownerType, ownerId);
        return { deleted: true };
      },
    };
  }

  /**
   * Get all memory tools
   */
  getAllTools() {
    return [
      this.createStoreTool(),
      this.createRetrieveTool(),
      this.createSearchTool(),
      this.createDeleteTool(),
    ];
  }
}

