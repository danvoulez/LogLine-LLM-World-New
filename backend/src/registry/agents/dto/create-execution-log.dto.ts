import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsArray,
  IsDateString,
} from 'class-validator';
import type { ExecutionStatus } from '../entities/agent-execution-log.entity';

export class CreateExecutionLogDto {
  @IsString()
  agent_id: string;

  @IsString()
  execution_id: string;

  @IsDateString()
  started_at: string;

  @IsOptional()
  @IsDateString()
  finished_at?: string;

  @IsEnum(['running', 'success', 'failed', 'cancelled'])
  status: ExecutionStatus;

  @IsOptional()
  @IsInt()
  total_steps?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools_used?: string[];

  @IsOptional()
  @IsInt()
  cost_cents?: number;

  @IsOptional()
  @IsString()
  input_summary?: string;

  @IsOptional()
  @IsString()
  output_summary?: string;

  @IsOptional()
  @IsString()
  error_message?: string;

  @IsOptional()
  @IsString()
  error_stack?: string;
}

