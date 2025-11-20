import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Run } from './run.entity';
import { Step } from './step.entity';

export enum EventKind {
  RUN_STARTED = 'run_started',
  RUN_COMPLETED = 'run_completed',
  RUN_FAILED = 'run_failed',
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',
  STEP_FAILED = 'step_failed',
  TOOL_CALL = 'tool_call',
  LLM_CALL = 'llm_call',
  POLICY_EVAL = 'policy_eval',
  ERROR = 'error',
}

@Entity('events')
@Index(['run_id', 'ts'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  run_id: string;

  @Column({ type: 'uuid', nullable: true })
  step_id: string | null;

  @Column({
    type: 'enum',
    enum: EventKind,
  })
  kind: EventKind;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @CreateDateColumn()
  ts: Date;

  @ManyToOne(() => Run, (run) => run.events)
  @JoinColumn({ name: 'run_id' })
  run: Run;

  @ManyToOne(() => Step, (step) => step.events, { nullable: true })
  @JoinColumn({ name: 'step_id' })
  step: Step | null;
}

