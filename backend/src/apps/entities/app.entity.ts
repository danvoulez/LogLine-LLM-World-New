import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AppScope } from './app-scope.entity';
import { AppWorkflow } from './app-workflow.entity';
import { AppAction } from './app-action.entity';

export enum AppVisibility {
  PRIVATE = 'private',
  ORG = 'org',
  PUBLIC = 'public',
}

@Entity('apps')
export class App {
  @PrimaryColumn('varchar')
  id: string; // Custom ID from manifest (e.g., 'coding-agent-frontend')

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  icon: string | null;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('text', { nullable: true })
  owner: string | null;

  @Column({
    type: 'enum',
    enum: AppVisibility,
    default: AppVisibility.PRIVATE,
  })
  visibility: AppVisibility;

  @Column({ type: 'uuid', nullable: true })
  default_view_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => AppScope, (scope) => scope.app)
  scopes: AppScope[];

  @OneToMany(() => AppWorkflow, (workflow) => workflow.app)
  workflows: AppWorkflow[];

  @OneToMany(() => AppAction, (action) => action.app)
  actions: AppAction[];
}
