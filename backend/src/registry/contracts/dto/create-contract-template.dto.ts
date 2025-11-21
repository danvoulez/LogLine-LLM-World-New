import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  IsArray,
  IsInt,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContractTemplateDto {
  @IsUUID()
  tenant_id: string;

  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsObject()
  template_data: {
    tipo?: string;
    escopo?: string[];
    prazo_dias?: number;
    multa_atraso?: {
      tipo: 'percentual_dia' | 'valor_fixo';
      valor: number;
    };
    clausulas?: {
      consequencia_normal?: string;
      possibilidades_questionamento?: string[];
      penalidades?: {
        atraso_injustificado?: string;
        nao_entrega?: string;
        qualidade_insatisfatoria?: string;
      };
    };
    [key: string]: any;
  };

  @IsArray()
  @IsString({ each: true })
  required_variables: string[];

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsInt()
  versao?: number;

  @IsOptional()
  @IsString()
  created_by_logline_id?: string;
}

