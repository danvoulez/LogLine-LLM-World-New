import { IsUUID, IsObject, IsString } from 'class-validator';

export class CreateFromTemplateDto {
  @IsUUID()
  template_id: string;

  @IsObject()
  variables: Record<string, any>; // Variables to interpolate in template

  @IsString()
  autor_logline_id: string;

  @IsString()
  contraparte_logline_id: string;

  @IsString()
  titulo: string;

  @IsString()
  tenant_id: string;
}

