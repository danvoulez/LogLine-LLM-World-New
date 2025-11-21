import { IsEnum, IsOptional, IsInt, IsString, IsObject } from 'class-validator';
import type { MovementType } from '../entities/registry-object-movement.entity';

export class CreateMovementDto {
  @IsEnum(['entry', 'exit', 'transfer', 'adjustment'])
  movement_type: MovementType;

  @IsOptional()
  @IsString()
  from_logline_id?: string;

  @IsOptional()
  @IsString()
  to_logline_id?: string;

  @IsOptional()
  @IsString()
  from_location?: string;

  @IsOptional()
  @IsString()
  to_location?: string;

  @IsOptional()
  @IsInt()
  quantity?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

