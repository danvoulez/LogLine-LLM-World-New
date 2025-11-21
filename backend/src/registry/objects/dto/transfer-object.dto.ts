import { IsString, IsOptional } from 'class-validator';

export class TransferObjectDto {
  @IsString()
  to_logline_id: string;

  @IsOptional()
  @IsString()
  to_location?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

