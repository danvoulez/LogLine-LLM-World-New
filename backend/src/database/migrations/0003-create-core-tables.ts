import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0003: Create all core tables
 * 
 * This migration creates all core tables for the LogLine LLM World system:
 * - workflows, runs, steps, events (execution)
 * - tools, agents (capabilities)
 * - apps, app_scopes, app_workflows, app_actions (app layer)
 * - files (file storage)
 * 
 * IMPORTANT: This migration must run AFTER 0001 (enable-pgvector) and BEFORE 0005 (default agents)
 */
export class CreateCoreTables1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Core Execution Tables
    // ============================================

    // Workflows: definitions of graphs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name         VARCHAR(255) NOT NULL,
        version      VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        definition   JSONB NOT NULL,
        type         VARCHAR(20) NOT NULL DEFAULT 'linear' CHECK (type IN ('linear', 'graph', 'subgraph')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Runs: each execution of a workflow
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS runs (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        workflow_version  VARCHAR(50) NOT NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
        mode              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'auto')),
        input             JSONB NOT NULL,
        result            JSONB,
        app_id            UUID, -- nullable, links to apps.id
        app_action_id     VARCHAR(255), -- nullable
        user_id           UUID, -- nullable
        tenant_id         UUID NOT NULL,
        cost_limit_cents  INTEGER, -- optional execution budget
        llm_calls_limit   INTEGER, -- optional execution budget
        latency_slo_ms    INTEGER, -- optional execution budget
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Steps: node execution
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS steps (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id       UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        node_id      VARCHAR(255) NOT NULL,
        type         VARCHAR(20) NOT NULL CHECK (type IN ('static', 'tool', 'agent', 'router', 'human_gate')),
        status       VARCHAR(20) NOT NULL DEFAULT 'pending',
        input        JSONB,
        output       JSONB,
        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at  TIMESTAMPTZ,
        CONSTRAINT steps_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped'))
      );
    `);

    // Events: append-only trace
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS events (
        id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id   UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        step_id  UUID REFERENCES steps(id) ON DELETE SET NULL,
        kind     VARCHAR(50) NOT NULL,
        payload  JSONB NOT NULL,
        ts       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT events_kind_check CHECK (
          kind IN (
            'run_started',
            'run_completed',
            'run_failed',
            'step_started',
            'step_completed',
            'step_failed',
            'tool_call',
            'llm_call',
            'policy_eval',
            'error'
          )
        )
      );
    `);

    // ============================================
    // Tools & Agents Tables
    // ============================================

    // Tools: tool definitions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id            VARCHAR(255) PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        input_schema  JSONB NOT NULL,
        handler_type  VARCHAR(50), -- 'code', 'http', 'builtin'
        handler_config JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Agents: agent definitions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id            VARCHAR(255) PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        instructions  TEXT,
        model_profile JSONB NOT NULL,
        allowed_tools VARCHAR(255)[] DEFAULT '{}',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // App Layer Tables
    // ============================================

    // Apps: app definitions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS apps (
        id              VARCHAR(255) PRIMARY KEY,
        name            VARCHAR(255) NOT NULL,
        icon            VARCHAR(255),
        description     TEXT,
        owner           VARCHAR(255),
        visibility      VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'org', 'public')),
        default_view_id UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // App Scopes: permissions for apps
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_scopes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id      VARCHAR(255) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        scope_type  VARCHAR(20) NOT NULL CHECK (scope_type IN ('tool', 'memory', 'external')),
        scope_value VARCHAR(255) NOT NULL,
        UNIQUE(app_id, scope_type, scope_value)
      );
    `);

    // App Workflows: workflows linked to apps
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_workflows (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id        VARCHAR(255) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        alias         VARCHAR(255) NOT NULL,
        workflow_id   UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        label         VARCHAR(255) NOT NULL,
        default_mode  VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (default_mode IN ('draft', 'auto')),
        UNIQUE(app_id, alias)
      );
    `);

    // App Actions: actions exposed by apps
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_actions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id          VARCHAR(255) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        action_id       VARCHAR(255) NOT NULL,
        label           VARCHAR(255) NOT NULL,
        app_workflow_id UUID NOT NULL REFERENCES app_workflows(id) ON DELETE CASCADE,
        input_mapping   JSONB NOT NULL,
        UNIQUE(app_id, action_id)
      );
    `);

    // ============================================
    // File Storage Table
    // ============================================

    // Files: file storage
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS files (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id        UUID REFERENCES runs(id) ON DELETE SET NULL,
        app_id        VARCHAR(255) REFERENCES apps(id) ON DELETE SET NULL,
        path          VARCHAR(255) NOT NULL,
        content       TEXT NOT NULL,
        size          BIGINT NOT NULL DEFAULT 0,
        mime_type     VARCHAR(100),
        version       INTEGER NOT NULL DEFAULT 1,
        parent_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
        tenant_id     VARCHAR(255),
        user_id       VARCHAR(255),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // Indexes for Performance
    // ============================================

    // Runs indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_app ON runs(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_tenant ON runs(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);`);

    // Steps indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_steps_node ON steps(node_id);`);

    // Events indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, ts);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_step ON events(step_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);`);

    // App indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_app_scopes_app ON app_scopes(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_app_workflows_app ON app_workflows(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_app_actions_app ON app_actions(app_id);`);

    // Files indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_files_run ON files(run_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_files_app ON files(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);`);

    console.log('✅ Core tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order (respecting foreign key dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS files CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_actions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_workflows CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_scopes CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS apps CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS agents CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tools CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS events CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS steps CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS runs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS workflows CASCADE;`);
    console.log('✅ Core tables dropped');
  }
}

