import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AlertHistory } from './alert-history.entity';

export type AlertRuleType = 
  | 'error_rate' 
  | 'budget_exceeded' 
  | 'policy_denials' 
  | 'memory_usage' 
  | 'rate_limit';

export type AlertThresholdOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

export interface AlertThreshold {
  value: number;
  operator: AlertThresholdOperator;
  window_minutes?: number; // Time window for evaluation (default: 5)
}

export interface AlertChannel {
  type: 'webhook' | 'email' | 'slack' | 'pagerduty';
  config: {
    url?: string; // For webhook
    email?: string; // For email
    api_key?: string; // For PagerDuty
    channel?: string; // For Slack
  };
}

@Entity('alert_configs')
@Index(['tenant_id'])
@Index(['enabled', 'rule_type'])
export class AlertConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  rule_type: AlertRuleType;

  @Column({ type: 'jsonb' })
  threshold: AlertThreshold;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: [] })
  channels: AlertChannel[];

  @Column({ type: 'uuid', nullable: true })
  tenant_id?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => AlertHistory, (history) => history.alert_config)
  history: AlertHistory[];
}

