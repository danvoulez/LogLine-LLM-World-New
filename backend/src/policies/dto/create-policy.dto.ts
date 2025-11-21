import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyScope, PolicyEffect, PolicyRuleExpr } from '../entities/policy.entity';

export class PolicyConditionDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsString()
  @IsNotEmpty()
  operator: string;

  @IsOptional()
  value?: any;
}

export class PolicyRuleExprDto implements PolicyRuleExpr {
  @ValidateNested({ each: true })
  @Type(() => PolicyConditionDto)
  conditions: PolicyConditionDto[];

  @IsOptional()
  @IsEnum(['AND', 'OR'])
  logic?: 'AND' | 'OR';
}

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['global', 'tenant', 'app', 'tool', 'workflow', 'agent'])
  @IsNotEmpty()
  scope: PolicyScope;

  @IsOptional()
  @IsString()
  scope_id?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PolicyRuleExprDto)
  rule_expr: PolicyRuleExprDto;

  @IsEnum(['allow', 'deny', 'require_approval', 'modify'])
  @IsNotEmpty()
  effect: PolicyEffect;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

