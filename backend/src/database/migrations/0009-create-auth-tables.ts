import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables0009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email        TEXT NOT NULL UNIQUE,
        password_hash TEXT, -- nullable for OAuth users
        name         TEXT,
        avatar_url   TEXT,
        role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'developer')),
        tenant_id    UUID, -- nullable, for multi-tenancy
        metadata     JSONB,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    `);

    // Sessions table (JWT refresh tokens)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   TEXT NOT NULL,
        expires_at   TIMESTAMPTZ NOT NULL,
        ip_address   TEXT,
        user_agent   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    `);

    // API Keys table (for programmatic access)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        key_hash     TEXT NOT NULL UNIQUE,
        permissions  TEXT[] NOT NULL DEFAULT '{}',
        expires_at   TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys;`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
  }
}

