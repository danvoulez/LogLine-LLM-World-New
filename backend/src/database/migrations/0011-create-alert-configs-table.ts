import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlertConfigsTable0011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alert_configs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT NOT NULL,
        description  TEXT,
        rule_type    TEXT NOT NULL CHECK (rule_type IN ('error_rate', 'budget_exceeded', 'policy_denials', 'memory_usage', 'rate_limit')),
        threshold    JSONB NOT NULL, -- { value: number, operator: 'gt'|'lt'|'eq' }
        enabled      BOOLEAN NOT NULL DEFAULT true,
        channels     JSONB NOT NULL DEFAULT '[]', -- [{ type: 'webhook'|'email'|'slack', config: {...} }]
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_alert_configs_tenant ON alert_configs(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled, rule_type);
    `);

    // Alert history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_config_id UUID REFERENCES alert_configs(id) ON DELETE CASCADE,
        triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        value        JSONB NOT NULL, -- Actual value that triggered the alert
        message      TEXT,
        resolved_at  TIMESTAMPTZ,
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_alert_history_config ON alert_history(alert_config_id, triggered_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON alert_history(tenant_id, triggered_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS alert_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS alert_configs;`);
  }
}

