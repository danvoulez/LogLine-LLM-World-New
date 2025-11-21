import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('api_keys')
@Index(['user_id'])
@Index(['key_hash'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', unique: true })
  key_hash: string;

  @Column({ type: 'text', array: true, default: [] })
  permissions: string[];

  @Column({ type: 'timestamptz', nullable: true })
  expires_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

