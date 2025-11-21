import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RegistryObject } from './registry-object.entity';

export type MovementType = 'entry' | 'exit' | 'transfer' | 'adjustment';

/**
 * Registry Object Movement Entity - History of Object Movements
 * 
 * Tracks all movements, transfers, and changes to objects for full traceability.
 */
@Entity('registry_object_movements')
@Index(['object_id'])
@Index(['movement_type'])
export class RegistryObjectMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  object_id: string;

  @ManyToOne(() => RegistryObject, (obj) => obj.movements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'object_id' })
  object: RegistryObject;

  @Column('text')
  movement_type: MovementType;

  @Column('varchar', { length: 50, nullable: true })
  from_logline_id?: string; // References core_people.logline_id

  @Column('varchar', { length: 50, nullable: true })
  to_logline_id?: string; // References core_people.logline_id

  @Column('text', { nullable: true })
  from_location?: string;

  @Column('text', { nullable: true })
  to_location?: string;

  @Column('integer', { nullable: true })
  quantity?: number;

  @Column('text', { nullable: true })
  reason?: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

