import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AlertConfig } from './alert-config.entity';

@Entity('alert_history')
@Index(['alert_config_id', 'triggered_at'])
@Index(['tenant_id', 'triggered_at'])
export class AlertHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  alert_config_id: string;

  @ManyToOne(() => AlertConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_config_id' })
  alert_config: AlertConfig;

  @CreateDateColumn({ type: 'timestamptz' })
  triggered_at: Date;

  @Column({ type: 'jsonb' })
  value: Record<string, any>; // Actual value that triggered the alert

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at?: Date;

  @Column({ type: 'uuid', nullable: true })
  tenant_id?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

