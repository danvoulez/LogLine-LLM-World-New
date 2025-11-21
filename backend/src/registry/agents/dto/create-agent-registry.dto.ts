import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';
import type { OnboardingStatus, TrainingType, MemoryScope, Visibility } from '../../../agents/entities/agent.entity';

export class CreateAgentRegistryDto {
  @IsString()
  id: string; // e.g., 'agent.ticket_triage'

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsString()
  instructions: string;

  @IsObject()
  model_profile: {
    provider: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
  };

  @IsArray()
  @IsString({ each: true })
  allowed_tools: string[];

  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  owner_logline_id?: string;

  @IsOptional()
  @IsString()
  created_by_logline_id?: string;

  @IsOptional()
  @IsEnum(['general', 'personalized', 'custom'])
  training_type?: TrainingType;

  @IsOptional()
  @IsBoolean()
  memory_enabled?: boolean;

  @IsOptional()
  @IsEnum(['private', 'tenant', 'org', 'public'])
  memory_scope?: MemoryScope;

  @IsOptional()
  @IsEnum(['tenant', 'org', 'public'])
  visibility?: Visibility;
}

