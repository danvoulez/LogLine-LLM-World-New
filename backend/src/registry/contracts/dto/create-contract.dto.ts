import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsArray,
  IsBoolean,
} from 'class-validator';
import type { ContractType, DispatchType } from '../entities/registry-contract.entity';

export class CreateContractDto {
  @IsUUID()
  tenant_id: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsEnum(['prestacao_servico', 'compra_venda', 'trabalho', 'outro'])
  tipo: ContractType;

  @IsString()
  autor_logline_id: string;

  @IsString()
  contraparte_logline_id: string; // Can be person or agent

  @IsOptional()
  @IsString()
  testemunha_logline_id?: string;

  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  escopo?: string[];

  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @IsOptional()
  @IsInt()
  prazo_dias?: number;

  @IsOptional()
  @IsInt()
  valor_total_cents?: number;

  @IsOptional()
  @IsString()
  moeda?: string;

  @IsOptional()
  @IsString()
  forma_pagamento?: string;

  @IsOptional()
  @IsObject()
  multa_atraso?: {
    tipo: 'percentual_dia' | 'valor_fixo';
    valor: number;
  };

  @IsOptional()
  @IsObject()
  clausulas?: {
    consequencia_normal?: string;
    possibilidades_questionamento?: string[];
    penalidades?: {
      atraso_injustificado?: string;
      nao_entrega?: string;
      qualidade_insatisfatoria?: string;
    };
  };

  @IsOptional()
  @IsUUID()
  idea_id?: string;

  @IsOptional()
  @IsEnum(['publico', 'hierarquico', 'automatizado'])
  despacho_tipo?: DispatchType;

  @IsOptional()
  @IsObject()
  despacho_config?: Record<string, any>;
}

