import { IsInt, IsOptional, IsString, IsObject, Min, Max } from 'class-validator';

export class EvaluateAgentDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  evaluation?: string;

  @IsOptional()
  @IsObject()
  criteria?: {
    accuracy?: number;
    speed?: number;
    cost_efficiency?: number;
    helpfulness?: number;
    [key: string]: number | undefined;
  };

  @IsOptional()
  @IsString()
  run_id?: string;
}

