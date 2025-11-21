import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type OnboardingStatus = 'pending' | 'in_training' | 'trained' | 'certified' | 'suspended';
export type TrainingType = 'general' | 'personalized' | 'custom';
export type MemoryScope = 'private' | 'tenant' | 'org' | 'public';
export type Visibility = 'tenant' | 'org' | 'public';

@Entity('agents')
@Index(['logline_agent_id'])
@Index(['tenant_id'])
@Index(['owner_logline_id'])
@Index(['active_contract_id'])
@Index(['onboarding_status'])
export class Agent {
  @PrimaryColumn('varchar')
  id: string; // e.g., 'agent.ticket_triage'

  @Column('varchar', { length: 50, unique: true, nullable: true })
  logline_agent_id?: string; // 'LL-AGENT-2024-000123456' (universal identity)

  @Column('uuid', { nullable: true })
  tenant_id?: string; // NULL = public/shared agent

  @Column('varchar', { length: 255, nullable: true })
  app_id?: string; // App that created this agent

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('text', { nullable: true })
  avatar_url?: string;

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

  // Onboarding and Training
  @Column('text', { default: 'pending' })
  onboarding_status: OnboardingStatus;

  @Column('text', { nullable: true })
  training_type?: TrainingType;

  @Column('jsonb', { nullable: true })
  training_data?: Record<string, any>;

  @Column('timestamptz', { nullable: true })
  training_completed_at?: Date;

  @Column('varchar', { length: 50, nullable: true })
  certified_by_logline_id?: string; // References core_people.logline_id

  // Memory Configuration
  @Column('boolean', { default: true })
  memory_enabled: boolean;

  @Column('text', { default: 'private' })
  memory_scope: MemoryScope;

  // Contract (will reference registry_contracts when Phase 5.3 is implemented)
  @Column('uuid', { nullable: true })
  active_contract_id?: string;

  @Column('jsonb', { nullable: true })
  contract_scope?: {
    allowed_tools?: string[];
    max_cost_per_run_cents?: number;
    max_llm_calls_per_run?: number;
    allowed_workflows?: string[];
    restricted_actions?: string[];
  };

  // Accountability
  @Column('varchar', { length: 50, nullable: true })
  created_by_logline_id?: string; // References core_people.logline_id

  @Column('varchar', { length: 50, nullable: true })
  owner_logline_id?: string; // References core_people.logline_id

  @Column('boolean', { default: true })
  accountability_enabled: boolean;

  // Performance Metrics
  @Column('integer', { default: 0 })
  total_runs: number;

  @Column('integer', { default: 0 })
  successful_runs: number;

  @Column('integer', { default: 0 })
  failed_runs: number;

  @Column('integer', { nullable: true })
  avg_cost_per_run_cents?: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  reputation_score?: number; // 0.00 to 5.00

  // Visibility
  @Column('text', { default: 'tenant' })
  visibility: Visibility;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

