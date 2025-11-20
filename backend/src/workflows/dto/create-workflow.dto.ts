import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowType } from '../entities/workflow.entity';

class NodeDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  [key: string]: any;
}

class EdgeDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsOptional()
  condition?: string;
}

class WorkflowDefinitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];

  @IsString()
  @IsNotEmpty()
  entryNode: string;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDefinitionDto)
  definition: WorkflowDefinitionDto;

  @IsEnum(WorkflowType)
  @IsOptional()
  type?: WorkflowType;
}
