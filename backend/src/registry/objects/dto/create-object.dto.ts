import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ObjectType, Visibility } from '../entities/registry-object.entity';
import { CreateServiceObjectDto } from './create-service-object.dto';

export class CreateObjectDto {
  @IsEnum([
    'document',
    'file',
    'merchandise',
    'collection',
    'lost_found',
    'inventory',
  ])
  object_type: ObjectType;

  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  identifier?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  owner_logline_id?: string;

  @IsOptional()
  @IsString()
  current_custodian_logline_id?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(['tenant', 'org', 'public'])
  visibility?: Visibility;
}

