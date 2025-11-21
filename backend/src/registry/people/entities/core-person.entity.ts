import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { TenantPeopleRelationship } from './tenant-people-relationship.entity';

/**
 * Core Person Entity - Universal Identity (Cross-App)
 * 
 * Represents a person's universal identity across the entire LogLine ecosystem.
 * The LogLine ID is permanent and portable across all apps and tenants.
 */
@Entity('core_people')
@Index(['cpf_hash'])
@Index(['email_primary'])
export class CorePerson {
  @PrimaryColumn('varchar', { length: 50 })
  logline_id: string; // e.g., 'LL-BR-2024-000123456'

  @Column('varchar', { length: 255, unique: true, nullable: true })
  cpf_hash?: string; // SHA-256 hash of CPF for privacy

  @Column('varchar', { length: 255, unique: true, nullable: true })
  email_primary?: string;

  @Column('text', { nullable: true })
  name?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => TenantPeopleRelationship, (rel) => rel.person)
  tenant_relationships: TenantPeopleRelationship[];
}

