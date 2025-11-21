import { IsEmail, IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsString()
  cpf: string; // Required for Registry identity

  @IsOptional()
  @IsUUID()
  tenant_id?: string;
}
