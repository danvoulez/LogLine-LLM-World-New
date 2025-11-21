import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class TrainAgentDto {
  @IsEnum(['general', 'personalized', 'custom'])
  training_type: 'general' | 'personalized' | 'custom';

  @IsOptional()
  @IsObject()
  training_data?: Record<string, any>;

  @IsOptional()
  @IsString()
  trained_by_logline_id?: string;
}

