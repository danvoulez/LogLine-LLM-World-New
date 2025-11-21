import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Agent } from '../../../agents/entities/agent.entity';

export type TrainingResult = 'success' | 'failed' | 'partial';

/**
 * Agent Training History Entity
 * 
 * Tracks all training sessions for agents, including performance metrics.
 */
@Entity('registry_agent_training_history')
@Index(['agent_id'])
export class AgentTrainingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  agent_id: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column('text')
  training_type: 'general' | 'personalized' | 'custom';

  @Column('jsonb', { nullable: true })
  training_data?: Record<string, any>;

  @Column('varchar', { length: 50, nullable: true })
  trained_by_logline_id?: string; // References core_people.logline_id

  @Column('text', { nullable: true })
  result?: TrainingResult;

  @Column('jsonb', { nullable: true })
  performance_metrics?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    improvement?: Record<string, any>;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

