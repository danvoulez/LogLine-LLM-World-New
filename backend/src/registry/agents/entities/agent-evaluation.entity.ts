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

/**
 * Agent Evaluation Entity
 * 
 * Stores evaluations/ratings of agents by people, used for reputation scoring.
 */
@Entity('registry_agent_evaluations')
@Index(['agent_id'])
@Index(['evaluator_logline_id'])
export class AgentEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  agent_id: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column('varchar', { length: 50 })
  evaluator_logline_id: string; // References core_people.logline_id

  @Column('uuid', { nullable: true })
  run_id?: string; // Optional: specific run that was evaluated

  @Column('integer')
  rating: number; // 1 to 5

  @Column('text', { nullable: true })
  evaluation?: string; // Detailed feedback

  @Column('jsonb', { nullable: true })
  criteria?: {
    accuracy?: number;
    speed?: number;
    cost_efficiency?: number;
    helpfulness?: number;
    [key: string]: number | undefined;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

