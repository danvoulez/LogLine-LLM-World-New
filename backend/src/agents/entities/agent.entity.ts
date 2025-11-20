import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agents')
export class Agent {
  @PrimaryColumn('varchar')
  id: string; // e.g., 'agent.ticket_triage'

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  instructions: string; // System prompt/instructions for the agent

  @Column('jsonb')
  model_profile: {
    provider: string; // 'openai', 'anthropic', 'google'
    model: string; // 'gpt-4o', 'claude-3-5-sonnet', etc.
    temperature?: number;
    max_tokens?: number;
  };

  @Column('jsonb', { default: '[]' })
  allowed_tools: string[]; // Array of tool IDs this agent can use

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

