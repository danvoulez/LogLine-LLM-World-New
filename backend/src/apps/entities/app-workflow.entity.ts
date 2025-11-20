import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { App } from './app.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { AppAction } from './app-action.entity';
import { RunMode } from '../../runs/entities/run.entity';

@Entity('app_workflows')
export class AppWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @Column()
  alias: string; // app-local ID, e.g. "chat_support"

  @Column({ type: 'uuid' })
  workflow_id: string;

  @Column()
  label: string;

  @Column({
    type: 'enum',
    enum: RunMode,
    default: RunMode.DRAFT,
  })
  default_mode: RunMode;

  @ManyToOne(() => App, (app) => app.workflows)
  @JoinColumn({ name: 'app_id' })
  app: App;

  @ManyToOne(() => Workflow)
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @OneToMany(() => AppAction, (action) => action.app_workflow)
  actions: AppAction[];
}

