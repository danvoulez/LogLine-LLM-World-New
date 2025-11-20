import { IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';

export class CreateFileDto {
  @IsString()
  path: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  run_id?: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;
}

