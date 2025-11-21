import { IsString, IsOptional, IsUUID, IsNumber, Min, Validate } from 'class-validator';
import { isValidPath } from '../../common/utils/path-validator.util';

export class CreateFileDto {
  @IsString()
  @Validate((value: string) => isValidPath(value), {
    message: 'Invalid file path: path traversal or dangerous characters detected',
  })
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

