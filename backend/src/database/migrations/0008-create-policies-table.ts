import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0008: Create policies table for Policy Engine v1
 * 
 * This migration creates the policies table to support rule-based policy evaluation.
 * Policies can be scoped to global, tenant, app, tool, workflow, or agent level.
 */
export class CreatePoliciesTable1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS policies (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        scope       VARCHAR(50) NOT NULL CHECK (scope IN ('global', 'tenant', 'app', 'tool', 'workflow', 'agent')),
        scope_id    VARCHAR(255), -- nullable, ID of the scoped entity (UUID or string)
        rule_expr   JSONB NOT NULL, -- DSL/JSON for engine to evaluate
        effect      VARCHAR(20) NOT NULL CHECK (effect IN ('allow', 'deny', 'require_approval', 'modify')),
        priority    INTEGER NOT NULL DEFAULT 100, -- lower = higher priority
        enabled     BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_policies_scope ON policies(scope, scope_id);
      CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled, priority);
      CREATE INDEX IF NOT EXISTS idx_policies_effect ON policies(effect);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS policies CASCADE;`);
  }
}

