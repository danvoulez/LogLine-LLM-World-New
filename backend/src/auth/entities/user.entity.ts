import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type UserRole = 'user' | 'admin' | 'developer';

@Entity('users')
@Index(['email'])
@Index(['tenant_id'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  password_hash?: string; // nullable for OAuth users

  @Column({ type: 'text', nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  avatar_url?: string;

  @Column({ type: 'text', default: 'user' })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  tenant_id?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  logline_id?: string; // Link to Registry Core Person

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

