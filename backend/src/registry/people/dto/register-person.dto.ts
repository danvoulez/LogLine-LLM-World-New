import { IsString, IsEmail, IsOptional, IsUUID, IsEnum } from 'class-validator';
import type { PersonRole } from '../entities/tenant-people-relationship.entity';

export class RegisterPersonDto {
  @IsString()
  cpf: string; // Will be hashed for privacy

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsUUID()
  tenant_id: string;

  @IsOptional()
  @IsEnum(['customer', 'vendor', 'employee', 'admin', 'other'])
  role?: PersonRole;

  @IsOptional()
  tenant_specific_data?: Record<string, any>;
}

