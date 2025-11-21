import { IsString, IsOptional, IsUUID, IsNumber, Min, Validate, MaxLength } from 'class-validator';
import { isValidPath } from '../../common/utils/path-validator.util';

// Maximum file size: 10MB (10 * 1024 * 1024 bytes)
// For base64 encoding, this is approximately 13.3MB of base64 string
// We use a conservative limit of 10MB to prevent memory issues in serverless
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE_BASE64 = Math.floor(MAX_FILE_SIZE_BYTES * 1.33); // ~13.3MB base64

export class CreateFileDto {
  @IsString()
  @Validate((value: string) => isValidPath(value), {
    message: 'Invalid file path: path traversal or dangerous characters detected',
  })
  path: string;

  @IsString()
  @MaxLength(MAX_FILE_SIZE_BASE64, {
    message: `File content exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. Consider using Vercel Blob or S3 for large files.`,
  })
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

