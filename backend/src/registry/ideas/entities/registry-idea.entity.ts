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
import { RegistryIdeaVote } from './registry-idea-vote.entity';

export type IdeaStatus =
  | 'aguardando_votos'
  | 'em_votacao'
  | 'aprovada'
  | 'rejeitada'
  | 'adiada'
  | 'em_execucao'
  | 'concluida';

/**
 * Registry Idea Entity - Budget Democracy
 * 
 * Collaborative voting system for prioritizing ideas with cost vs priority matrix.
 */
@Entity('registry_ideas')
@Index(['tenant_id'])
@Index(['status'])
@Index(['prioridade_consensual'], { where: 'prioridade_consensual IS NOT NULL' })
@Index(['autor_logline_id'])
export class RegistryIdea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('varchar', { length: 255, nullable: true })
  app_id?: string;

  // Conteúdo
  @Column('text')
  titulo: string;

  @Column('text', { nullable: true })
  descricao?: string;

  @Column('varchar', { length: 50 })
  autor_logline_id: string; // References core_people.logline_id

  // Priorização
  @Column('integer')
  prioridade_autor: number; // 1 to 10

  @Column('decimal', { precision: 4, scale: 2, nullable: true })
  prioridade_consensual?: number; // Calculated weighted average

  // Financeiro
  @Column('integer', { nullable: true })
  custo_estimado_cents?: number;

  @Column('varchar', { length: 3, default: 'BRL' })
  moeda: string;

  // Status
  @Column('text', { default: 'aguardando_votos' })
  status: IdeaStatus;

  // Relacionamentos
  @Column('uuid', { nullable: true })
  parent_idea_id?: string; // For sub-ideas

  @ManyToOne(() => RegistryIdea, { nullable: true })
  @JoinColumn({ name: 'parent_idea_id' })
  parent_idea?: RegistryIdea;

  @Column('uuid', { nullable: true })
  contract_id?: string; // References registry_contracts.id (when idea becomes contract)

  // Retrospectiva
  @Column('integer', { nullable: true })
  custo_real_cents?: number;

  @Column('text', { nullable: true })
  impacto_real?: string;

  @Column('text', { nullable: true })
  aprendizados?: string;

  // Configuração
  @Column('integer', { default: 7 })
  periodo_votacao_dias: number;

  @Column('timestamptz', { default: () => 'NOW()' })
  data_submissao: Date;

  @Column('timestamptz', { nullable: true })
  data_fim_votacao?: Date;

  @Column('timestamptz', { nullable: true })
  data_aprovacao?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => RegistryIdeaVote, (vote) => vote.idea)
  votes: RegistryIdeaVote[];
}

