import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { App } from './app.entity';
import { AppWorkflow } from './app-workflow.entity';

@Entity('app_actions')
export class AppAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @Column()
  action_id: string; // stable string, e.g. "start_chat"

  @Column()
  label: string;

  @Column({ type: 'uuid' })
  app_workflow_id: string;

  @Column('jsonb')
  input_mapping: Record<string, any>; // mapping from event/context -> workflow input

  @ManyToOne(() => App, (app) => app.actions)
  @JoinColumn({ name: 'app_id' })
  app: App;

  @ManyToOne(() => AppWorkflow, (workflow) => workflow.actions)
  @JoinColumn({ name: 'app_workflow_id' })
  app_workflow: AppWorkflow;
}

