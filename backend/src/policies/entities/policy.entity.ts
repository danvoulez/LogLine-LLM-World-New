import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type PolicyScope = 'global' | 'tenant' | 'app' | 'tool' | 'workflow' | 'agent';
export type PolicyEffect = 'allow' | 'deny' | 'require_approval' | 'modify';

export interface PolicyRuleExpr {
  conditions: PolicyCondition[];
  logic?: 'AND' | 'OR'; // Default: AND
}

export interface PolicyCondition {
  field: string; // e.g., 'tool.risk_level', 'run.mode', 'user.role'
  operator: PolicyOperator;
  value: any;
}

export type PolicyOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'exists'
  | 'not_exists';

@Entity('policies')
@Index(['scope', 'scope_id'])
@Index(['enabled', 'priority'])
@Index(['effect'])
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  scope: PolicyScope;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scope_id?: string;

  @Column({ type: 'jsonb' })
  rule_expr: PolicyRuleExpr;

  @Column({
    type: 'varchar',
    length: 20,
  })
  effect: PolicyEffect;

  @Column({ type: 'integer', default: 100 })
  priority: number; // Lower = higher priority

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

