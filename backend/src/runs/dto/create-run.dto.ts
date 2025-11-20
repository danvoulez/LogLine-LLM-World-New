import {
  IsObject,
  IsEnum,
  IsOptional,
  IsUUID,
  IsString,
} from 'class-validator';
import { RunMode } from '../entities/run.entity';

export class CreateRunDto {
  @IsObject()
  input: Record<string, any>;

  @IsEnum(RunMode)
  @IsOptional()
  mode?: RunMode;

  @IsUUID()
  @IsOptional()
  app_id?: string;

  @IsString()
  @IsOptional()
  app_action_id?: string;

  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsUUID()
  @IsOptional()
  tenant_id?: string;
}

