import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { App } from './app.entity';

export enum ScopeType {
  TOOL = 'tool',
  MEMORY = 'memory',
  EXTERNAL = 'external',
}

@Entity('app_scopes')
export class AppScope {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @Column({
    type: 'enum',
    enum: ScopeType,
  })
  scope_type: ScopeType;

  @Column()
  scope_value: string;

  @ManyToOne(() => App, (app) => app.scopes)
  @JoinColumn({ name: 'app_id' })
  app: App;
}

