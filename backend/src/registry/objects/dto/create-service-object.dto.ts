import { IsEnum, IsString, IsObject, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export type ServiceType = 'one_time' | 'subscription' | 'usage_based';
export type PriceModelType = 'fixed' | 'hourly' | 'per_unit';
export type DeliveryMethod = 'remote' | 'on_site' | 'hybrid';

export class PriceModelDto {
  @IsEnum(['fixed', 'hourly', 'per_unit'])
  type: PriceModelType;

  @IsNumber()
  amount_cents: number;

  @IsString()
  currency: string;
}

export class SLADto {
  @IsNumber()
  response_time_hours: number;

  @IsNumber()
  completion_time_hours: number;
}

export class CreateServiceObjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['one_time', 'subscription', 'usage_based'])
  service_type: ServiceType;

  @IsString()
  provider_logline_id: string;

  @ValidateNested()
  @Type(() => PriceModelDto)
  price_model: PriceModelDto;

  @IsEnum(['remote', 'on_site', 'hybrid'])
  delivery_method: DeliveryMethod;

  @IsOptional()
  @ValidateNested()
  @Type(() => SLADto)
  sla?: SLADto;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsOptional()
  @IsString()
  app_id?: string;
}

