import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'execute' 
  | 'login' 
  | 'logout' 
  | 'failed_login'
  | 'policy_created'
  | 'policy_updated'
  | 'policy_deleted'
  | 'app_imported'
  | 'app_updated'
  | 'memory_stored'
  | 'memory_deleted';

export type AuditResourceType = 
  | 'workflow' 
  | 'tool' 
  | 'agent' 
  | 'app' 
  | 'policy' 
  | 'memory' 
  | 'user' 
  | 'auth'
  | 'run';

@Entity('audit_logs')
@Index(['user_id', 'created_at'])
@Index(['resource_type', 'resource_id'])
@Index(['tenant_id', 'created_at'])
@Index(['action', 'created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'text' })
  action: AuditAction;

  @Column({ type: 'text' })
  resource_type: AuditResourceType;

  @Column({ type: 'uuid', nullable: true })
  resource_id?: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, any>; // before/after for updates, metadata for other actions

  @Column({ type: 'text', nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

