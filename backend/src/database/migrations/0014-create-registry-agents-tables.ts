import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0014: Create Registry Agents Tables
 * 
 * This migration extends the agents table with Registry fields and creates
 * supporting tables for agent training history and evaluations.
 * 
 * IMPORTANT: This migration must run AFTER 0013 (create-registry-core-tables)
 */
export class CreateRegistryAgentsTables1700000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Extend agents table with Registry fields
    // ============================================

    // Add logline_agent_id (unique identity)
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS logline_agent_id VARCHAR(50) UNIQUE;
    `);

    // Add tenant_id and app_id
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS tenant_id UUID;
    `);

    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS app_id VARCHAR(255);
    `);

    // Add identity fields
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    `);

    // Add onboarding and training fields
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (onboarding_status IN ('pending', 'in_training', 'trained', 'certified', 'suspended')),
        ADD COLUMN IF NOT EXISTS training_type TEXT
          CHECK (training_type IN ('general', 'personalized', 'custom')),
        ADD COLUMN IF NOT EXISTS training_data JSONB,
        ADD COLUMN IF NOT EXISTS training_completed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS certified_by_logline_id VARCHAR(50);
    `);

    // Add memory configuration
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS memory_scope TEXT DEFAULT 'private'
          CHECK (memory_scope IN ('private', 'tenant', 'org', 'public'));
    `);

    // Add contract fields (registry_contracts will be created in Phase 5.3)
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS active_contract_id UUID,
        ADD COLUMN IF NOT EXISTS contract_scope JSONB;
    `);

    // Add accountability fields
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS created_by_logline_id VARCHAR(50),
        ADD COLUMN IF NOT EXISTS owner_logline_id VARCHAR(50),
        ADD COLUMN IF NOT EXISTS accountability_enabled BOOLEAN DEFAULT true;
    `);

    // Add performance metrics
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS total_runs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS successful_runs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS failed_runs INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS avg_cost_per_run_cents DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS reputation_score DECIMAL(3,2);
    `);

    // Add visibility
    await queryRunner.query(`
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'tenant'
          CHECK (visibility IN ('tenant', 'org', 'public'));
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_logline_id ON agents(logline_agent_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_logline_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_contract ON agents(active_contract_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_onboarding ON agents(onboarding_status);
    `);

    // ============================================
    // Agent Training History
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_agent_training_history (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id        VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        training_type   TEXT NOT NULL,
        training_data   JSONB,
        trained_by_logline_id VARCHAR(50),
        result          TEXT,
        performance_metrics JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_training_agent ON registry_agent_training_history(agent_id);
    `);

    // ============================================
    // Agent Evaluations
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_agent_evaluations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id        VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        evaluator_logline_id VARCHAR(50) NOT NULL,
        run_id          UUID,
        rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        evaluation      TEXT,
        criteria        JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_evaluations_agent ON registry_agent_evaluations(agent_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_evaluations_evaluator ON registry_agent_evaluations(evaluator_logline_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop supporting tables first
    await queryRunner.query(`DROP TABLE IF EXISTS registry_agent_evaluations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_agent_training_history;`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_onboarding;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_contract;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_owner;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_tenant;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agents_logline_id;`);

    // Remove columns from agents table
    await queryRunner.query(`
      ALTER TABLE agents
        DROP COLUMN IF EXISTS visibility,
        DROP COLUMN IF EXISTS reputation_score,
        DROP COLUMN IF EXISTS avg_cost_per_run_cents,
        DROP COLUMN IF EXISTS failed_runs,
        DROP COLUMN IF EXISTS successful_runs,
        DROP COLUMN IF EXISTS total_runs,
        DROP COLUMN IF EXISTS accountability_enabled,
        DROP COLUMN IF EXISTS owner_logline_id,
        DROP COLUMN IF EXISTS created_by_logline_id,
        DROP COLUMN IF EXISTS contract_scope,
        DROP COLUMN IF EXISTS active_contract_id,
        DROP COLUMN IF EXISTS memory_scope,
        DROP COLUMN IF EXISTS memory_enabled,
        DROP COLUMN IF EXISTS certified_by_logline_id,
        DROP COLUMN IF EXISTS training_completed_at,
        DROP COLUMN IF EXISTS training_data,
        DROP COLUMN IF EXISTS training_type,
        DROP COLUMN IF EXISTS onboarding_status,
        DROP COLUMN IF EXISTS avatar_url,
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS app_id,
        DROP COLUMN IF EXISTS tenant_id,
        DROP COLUMN IF EXISTS logline_agent_id;
    `);
  }
}

