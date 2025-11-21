import { IsInt, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class VoteIdeaDto {
  @IsInt()
  @Min(1)
  @Max(10)
  prioridade: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  @IsNumber()
  peso?: number; // Default 1.0, can be higher for stakeholders
}

