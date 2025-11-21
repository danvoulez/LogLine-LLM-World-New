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

export type ExecutionStatus = 'running' | 'success' | 'failed' | 'cancelled';

/**
 * Agent Execution Log Entity
 * 
 * Detailed logs of agent executions for observability and debugging.
 */
@Entity('registry_agent_execution_logs')
@Index(['agent_id'])
@Index(['started_at'])
@Index(['status'])
@Index(['agent_id', 'status'])
export class AgentExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  agent_id: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column('varchar', { length: 255 })
  execution_id: string; // ID da execução no AgentRuntime (run_id ou step_id)

  @Column('timestamptz')
  started_at: Date;

  @Column('timestamptz', { nullable: true })
  finished_at?: Date;

  @Column('varchar', { length: 50 })
  status: ExecutionStatus;

  // Métricas da execução
  @Column('integer', { nullable: true })
  total_steps?: number;

  @Column('jsonb', { nullable: true })
  tools_used?: string[]; // Array de tool_ids

  @Column('integer', { nullable: true })
  cost_cents?: number;

  // Input/Output (opcional, para auditoria)
  @Column('text', { nullable: true })
  input_summary?: string;

  @Column('text', { nullable: true })
  output_summary?: string;

  // Erros (se houver)
  @Column('text', { nullable: true })
  error_message?: string;

  @Column('text', { nullable: true })
  error_stack?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

