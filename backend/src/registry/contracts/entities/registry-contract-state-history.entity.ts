import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { RegistryContract } from './registry-contract.entity';

/**
 * Registry Contract State History Entity
 * 
 * Tracks all state transitions for contracts (audit trail).
 */
@Entity('registry_contract_state_history')
@Index(['contract_id'])
export class RegistryContractStateHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  contract_id: string;

  @ManyToOne(() => RegistryContract, (contract) => contract.state_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: RegistryContract;

  @Column('text', { nullable: true })
  estado_anterior?: string;

  @Column('text')
  estado_novo: string;

  @Column('text', { nullable: true })
  motivo?: string;

  @Column('varchar', { length: 50, nullable: true })
  changed_by_logline_id?: string; // References core_people.logline_id

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

