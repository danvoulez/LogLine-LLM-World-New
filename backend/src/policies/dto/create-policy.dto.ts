import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { PolicyScope, PolicyEffect, PolicyRuleExpr, PolicyOperator } from '../entities/policy.entity';

export class PolicyConditionDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsEnum(['equals', 'not_equals', 'in', 'not_in', 'greater_than', 'less_than', 'contains', 'starts_with', 'ends_with', 'exists', 'not_exists'])
  @IsNotEmpty()
  operator: PolicyOperator;

  // Value is optional for 'exists' and 'not_exists' operators, but required for others
  value: any;
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

