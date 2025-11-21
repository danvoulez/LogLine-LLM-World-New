import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { CorePerson } from './core-person.entity';

export type PersonRole = 'customer' | 'vendor' | 'employee' | 'admin' | 'other';

/**
 * Tenant People Relationship Entity - Tenant-Specific Data (Isolated)
 * 
 * Represents a person's relationship with a specific tenant.
 * Each tenant has isolated data about the person, maintaining privacy.
 */
@Entity('tenant_people_relationships')
@Unique(['logline_id', 'tenant_id'])
@Index(['tenant_id'])
@Index(['tenant_id', 'role'])
export class TenantPeopleRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50 })
  logline_id: string;

  @ManyToOne(() => CorePerson, (person) => person.tenant_relationships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'logline_id' })
  person: CorePerson;

  @Column('uuid')
  tenant_id: string;

  @Column('text')
  role: PersonRole;

  @Column('jsonb', { nullable: true })
  tenant_specific_data?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  permissions?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

