import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { IdeaStatus } from '../entities/registry-idea.entity';

export class CreateIdeaDto {
  @IsUUID()
  tenant_id: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  autor_logline_id: string;

  @IsInt()
  @Min(1)
  @Max(10)
  prioridade_autor: number;

  @IsOptional()
  @IsInt()
  custo_estimado_cents?: number;

  @IsOptional()
  @IsString()
  moeda?: string;

  @IsOptional()
  @IsUUID()
  parent_idea_id?: string;

  @IsOptional()
  @IsInt()
  periodo_votacao_dias?: number;
}

