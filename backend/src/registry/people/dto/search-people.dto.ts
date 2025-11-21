import { IsString, IsEmail, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPeopleDto {
  @IsOptional()
  @IsString()
  cpf?: string; // Will be hashed for search

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
