import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { RegistryContractStateHistory } from './registry-contract-state-history.entity';

export type ContractType = 'prestacao_servico' | 'compra_venda' | 'trabalho' | 'outro';
export type ContractState =
  | 'RASCUNHO'
  | 'VIGENTE'
  | 'QUESTIONADO'
  | 'CONCLUÍDO'
  | 'CANCELADO'
  | 'PENALIZADO';
export type DispatchType = 'publico' | 'hierarquico' | 'automatizado';

/**
 * Registry Contract Entity - Executable State Machine
 * 
 * Contracts are state machines with deterministic behavior.
 * States: RASCUNHO → VIGENTE → QUESTIONADO / CONCLUÍDO / CANCELADO
 */
@Entity('registry_contracts')
@Index(['tenant_id'])
@Index(['estado_atual'])
@Index(['autor_logline_id'])
@Index(['contraparte_logline_id'])
export class RegistryContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('varchar', { length: 255, nullable: true })
  app_id?: string;

  // Tipo
  @Column('text')
  tipo: ContractType;

  // Partes
  @Column('varchar', { length: 50 })
  autor_logline_id: string; // References core_people.logline_id

  @Column('varchar', { length: 50 })
  contraparte_logline_id: string; // References core_people.logline_id (can be agent!)

  @Column('varchar', { length: 50, nullable: true })
  testemunha_logline_id?: string; // References core_people.logline_id

  // Conteúdo
  @Column('text')
  titulo: string;

  @Column('text', { nullable: true })
  descricao?: string;

  @Column('jsonb', { nullable: true })
  escopo?: string[]; // Array of scope items

  @Column('date', { nullable: true })
  data_inicio?: Date;

  @Column('integer', { nullable: true })
  prazo_dias?: number;

  @Column('date', { nullable: true })
  data_limite?: Date;

  // Financeiro
  @Column('integer', { nullable: true })
  valor_total_cents?: number;

  @Column('varchar', { length: 3, default: 'BRL' })
  moeda: string;

  @Column('text', { nullable: true })
  forma_pagamento?: string;

  @Column('jsonb', { nullable: true })
  multa_atraso?: {
    tipo: 'percentual_dia' | 'valor_fixo';
    valor: number;
  };

  // Cláusulas
  @Column('jsonb', { nullable: true })
  clausulas?: {
    consequencia_normal?: string;
    possibilidades_questionamento?: string[];
    penalidades?: {
      atraso_injustificado?: string;
      nao_entrega?: string;
      qualidade_insatisfatoria?: string;
    };
  };

  // Estado
  @Column('text', { default: 'RASCUNHO' })
  estado_atual: ContractState;

  // Relacionamentos
  @Column('uuid', { nullable: true })
  idea_id?: string; // References registry_ideas.id

  @Column('uuid', { nullable: true })
  parent_contract_id?: string; // For addendums

  @ManyToOne(() => RegistryContract, { nullable: true })
  @JoinColumn({ name: 'parent_contract_id' })
  parent_contract?: RegistryContract;

  // Despacho
  @Column('text', { nullable: true })
  despacho_tipo?: DispatchType;

  @Column('jsonb', { nullable: true })
  despacho_config?: Record<string, any>;

  // Questionamento
  @Column('text', { nullable: true })
  questionamento_razao?: string;

  @Column('timestamptz', { nullable: true })
  questionamento_data?: Date;

  @Column('integer', { default: 3 })
  periodo_defesa_dias: number;

  @Column('text', { nullable: true })
  justificativa?: string;

  @Column('boolean', { nullable: true })
  justificativa_aceita?: boolean;

  // Penalidade
  @Column('integer', { nullable: true })
  penalidade_aplicada_cents?: number;

  @Column('timestamptz', { nullable: true })
  penalidade_data?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => RegistryContractStateHistory, (history) => history.contract)
  state_history: RegistryContractStateHistory[];
}

