import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Resource } from './resource.entity';

export type MemoryOwnerType = 'user' | 'tenant' | 'app' | 'agent' | 'run';
export type MemoryType = 'short_term' | 'long_term' | 'profile';
export type MemoryVisibility = 'private' | 'org' | 'public';

@Entity('memory_items')
@Index(['owner_type', 'owner_id'])
@Index(['owner_type', 'owner_id', 'type'])
export class MemoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  owner_type: MemoryOwnerType;

  @Column({ type: 'uuid' })
  owner_id: string;

  @Column({ type: 'varchar', length: 50 })
  type: MemoryType;

  @Column('text')
  content: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'vector', length: 1536, nullable: true })
  embedding: number[] | null;

  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: MemoryVisibility;

  @Column({ type: 'timestamptz', nullable: true })
  ttl: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => Resource, (resource) => resource.memory_item, { cascade: true })
  resources: Resource[];
}
