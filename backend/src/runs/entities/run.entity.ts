import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Step } from './step.entity';
import { Event } from './event.entity';

export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RunMode {
  DRAFT = 'draft',
  AUTO = 'auto',
}

@Entity('runs')
export class Run {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workflow_id: string;

  @Column({ type: 'varchar', length: 50 })
  workflow_version: string;

  @Column({ type: 'uuid', nullable: true })
  app_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  app_action_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({
    type: 'enum',
    enum: RunStatus,
    default: RunStatus.PENDING,
  })
  status: RunStatus;

  @Column({
    type: 'enum',
    enum: RunMode,
    default: RunMode.DRAFT,
  })
  mode: RunMode;

  @Column({ type: 'jsonb' })
  input: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'integer', nullable: true })
  cost_limit_cents: number | null;

  @Column({ type: 'integer', nullable: true })
  llm_calls_limit: number | null;

  @Column({ type: 'integer', nullable: true })
  latency_slo_ms: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Workflow, (workflow) => workflow.runs)
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @OneToMany(() => Step, (step) => step.run)
  steps: Step[];

  @OneToMany(() => Event, (event) => event.run)
  events: Event[];
}

