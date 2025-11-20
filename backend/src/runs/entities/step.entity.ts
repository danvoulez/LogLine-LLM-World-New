import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Run } from './run.entity';
import { Event } from './event.entity';

export enum StepType {
  AGENT = 'agent',
  TOOL = 'tool',
  ROUTER = 'router',
  STATIC = 'static',
  HUMAN_GATE = 'human_gate',
}

export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('steps')
export class Step {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  run_id: string;

  @Column({ type: 'varchar', length: 255 })
  node_id: string;

  @Column({
    type: 'enum',
    enum: StepType,
  })
  type: StepType;

  @Column({
    type: 'enum',
    enum: StepStatus,
    default: StepStatus.PENDING,
  })
  status: StepStatus;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, any> | null;

  @CreateDateColumn()
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  finished_at: Date | null;

  @ManyToOne(() => Run, (run) => run.steps)
  @JoinColumn({ name: 'run_id' })
  run: Run;

  @OneToMany(() => Event, (event) => event.step)
  events: Event[];
}

