import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MemoryItem } from './memory-item.entity';

@Entity('resources')
@Index(['memory_item_id'])
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  content: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'vector', length: 1536, nullable: true })
  embedding: number[] | null;

  @Column({ type: 'uuid' })
  memory_item_id: string;

  @ManyToOne(() => MemoryItem, (memoryItem) => memoryItem.resources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memory_item_id' })
  memory_item: MemoryItem;

  @Column({ type: 'int', default: 0 })
  chunk_index: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
