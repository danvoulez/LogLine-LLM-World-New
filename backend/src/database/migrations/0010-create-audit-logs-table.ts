import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable0010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        action       TEXT NOT NULL, -- create|update|delete|execute|login|logout|failed_login
        resource_type TEXT NOT NULL, -- workflow|tool|agent|app|policy|memory|user|auth
        resource_id  UUID,
        changes      JSONB, -- before/after for updates, metadata for other actions
        ip_address   TEXT,
        user_agent   TEXT,
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
  }
}

