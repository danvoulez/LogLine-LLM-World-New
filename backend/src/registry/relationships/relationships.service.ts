import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RegistryRelationship,
  EntityType,
  RelationshipType,
} from './entities/registry-relationship.entity';
import { CreateRelationshipDto } from './dto/create-relationship.dto';

/**
 * Relationships Service - Generic Entity Relationships
 * 
 * Handles:
 * - Creating relationships between any Registry entities
 * - Querying relationships (by source, target, type)
 * - Bidirectional relationship lookups
 * - Relationship metadata
 */
@Injectable()
export class RelationshipsService {
  constructor(
    @InjectRepository(RegistryRelationship)
    private relationshipRepository: Repository<RegistryRelationship>,
  ) {}

  /**
   * Create a new relationship
   */
  async create(dto: CreateRelationshipDto): Promise<RegistryRelationship> {
    // Check if relationship already exists
    const existing = await this.relationshipRepository.findOne({
      where: {
        source_type: dto.source_type,
        source_id: dto.source_id,
        target_type: dto.target_type,
        target_id: dto.target_id,
        relationship_type: dto.relationship_type,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Relationship already exists: ${dto.source_type}:${dto.source_id} --[${dto.relationship_type}]--> ${dto.target_type}:${dto.target_id}`,
      );
    }

    const relationship = this.relationshipRepository.create(dto);
    return this.relationshipRepository.save(relationship);
  }

  /**
   * Find relationship by ID
   */
  async findOne(id: string): Promise<RegistryRelationship> {
    const relationship = await this.relationshipRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException(`Relationship with ID ${id} not found`);
    }

    return relationship;
  }

  /**
   * Find relationships by source entity
   */
  async findBySource(
    sourceType: EntityType,
    sourceId: string,
    relationshipType?: RelationshipType,
  ): Promise<RegistryRelationship[]> {
    const query = this.relationshipRepository.createQueryBuilder('rel').where(
      'rel.source_type = :sourceType AND rel.source_id = :sourceId',
      { sourceType, sourceId },
    );

    if (relationshipType) {
      query.andWhere('rel.relationship_type = :relationshipType', {
        relationshipType,
      });
    }

    return query.orderBy('rel.created_at', 'DESC').getMany();
  }

  /**
   * Find relationships by target entity
   */
  async findByTarget(
    targetType: EntityType,
    targetId: string,
    relationshipType?: RelationshipType,
  ): Promise<RegistryRelationship[]> {
    const query = this.relationshipRepository.createQueryBuilder('rel').where(
      'rel.target_type = :targetType AND rel.target_id = :targetId',
      { targetType, targetId },
    );

    if (relationshipType) {
      query.andWhere('rel.relationship_type = :relationshipType', {
        relationshipType,
      });
    }

    return query.orderBy('rel.created_at', 'DESC').getMany();
  }

  /**
   * Find relationships between two entities (bidirectional)
   */
  async findBetween(
    entity1Type: EntityType,
    entity1Id: string,
    entity2Type: EntityType,
    entity2Id: string,
  ): Promise<RegistryRelationship[]> {
    return this.relationshipRepository.find({
      where: [
        {
          source_type: entity1Type,
          source_id: entity1Id,
          target_type: entity2Type,
          target_id: entity2Id,
        },
        {
          source_type: entity2Type,
          source_id: entity2Id,
          target_type: entity1Type,
          target_id: entity1Id,
        },
      ],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find all relationships of a specific type
   */
  async findByType(relationshipType: RelationshipType): Promise<RegistryRelationship[]> {
    return this.relationshipRepository.find({
      where: { relationship_type: relationshipType },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get all relationships for an entity (both as source and target)
   */
  async getEntityRelationships(
    entityType: EntityType,
    entityId: string,
  ): Promise<{
    outgoing: RegistryRelationship[];
    incoming: RegistryRelationship[];
  }> {
    const [outgoing, incoming] = await Promise.all([
      this.findBySource(entityType, entityId),
      this.findByTarget(entityType, entityId),
    ]);

    return { outgoing, incoming };
  }

  /**
   * Delete a relationship
   */
  async remove(id: string): Promise<void> {
    const relationship = await this.findOne(id);
    await this.relationshipRepository.remove(relationship);
  }

  /**
   * Delete relationships by criteria
   */
  async removeByCriteria(criteria: {
    source_type?: EntityType;
    source_id?: string;
    target_type?: EntityType;
    target_id?: string;
    relationship_type?: RelationshipType;
  }): Promise<number> {
    const result = await this.relationshipRepository.delete(criteria);
    return result.affected || 0;
  }

  /**
   * Update relationship metadata
   */
  async updateMetadata(
    id: string,
    metadata: Record<string, any>,
  ): Promise<RegistryRelationship> {
    const relationship = await this.findOne(id);
    relationship.metadata = { ...relationship.metadata, ...metadata };
    return this.relationshipRepository.save(relationship);
  }
}

