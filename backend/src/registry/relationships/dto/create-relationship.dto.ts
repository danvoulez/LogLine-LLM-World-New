import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';
import type { EntityType, RelationshipType } from '../entities/registry-relationship.entity';

export class CreateRelationshipDto {
  @IsEnum(['person', 'agent', 'object', 'idea', 'contract', 'app'])
  source_type: EntityType;

  @IsString()
  source_id: string;

  @IsEnum(['person', 'agent', 'object', 'idea', 'contract', 'app'])
  target_type: EntityType;

  @IsString()
  target_id: string;

  @IsEnum([
    'owns',
    'created',
    'references',
    'depends_on',
    'transforms_to',
    'works_under',
    'trained_by',
    'voted_on',
    'signed',
    'questioned',
    'uses',
    'installed',
    'related_to',
  ])
  relationship_type: RelationshipType;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

