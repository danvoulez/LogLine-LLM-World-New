import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type EntityType = 'person' | 'agent' | 'object' | 'idea' | 'contract' | 'app';
export type RelationshipType =
  | 'owns'
  | 'created'
  | 'references'
  | 'depends_on'
  | 'transforms_to'
  | 'works_under'
  | 'trained_by'
  | 'voted_on'
  | 'signed'
  | 'questioned'
  | 'uses'
  | 'installed'
  | 'related_to';

/**
 * Registry Relationship Entity - Generic Relationships
 * 
 * Links any entities in the Registry with typed relationships.
 * Examples:
 * - Person → Object: "owns"
 * - Person → Agent: "created"
 * - Agent → Contract: "works_under"
 * - Idea → Contract: "transforms_to"
 */
@Entity('registry_relationships')
@Index(['source_type', 'source_id'])
@Index(['target_type', 'target_id'])
@Index(['relationship_type'])
@Index(['source_type', 'target_type', 'relationship_type'])
export class RegistryRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  source_type: EntityType;

  @Column('text')
  source_id: string; // Can be UUID or string ID (for agents, apps)

  @Column('text')
  target_type: EntityType;

  @Column('text')
  target_id: string; // Can be UUID or string ID (for agents, apps)

  @Column('text')
  relationship_type: RelationshipType;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

