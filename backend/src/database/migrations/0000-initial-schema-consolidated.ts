import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0001: Initial Schema (Consolidated)
 * 
 * This is a CONSOLIDATED migration that replaces all previous migrations (0001-0023).
 * It creates the complete database schema for LogLine LLM World in a single migration.
 * 
 * Use this when starting fresh with an empty database.
 * 
 * IMPORTANT: If you have existing data, do NOT use this migration.
 * Instead, run the individual migrations in order.
 */
export class InitialSchemaConsolidated1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // 1. Extensions
    // ============================================
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension enabled');

    // ============================================
    // 2. Core Execution Tables
    // ============================================

    // Workflows
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

    // Runs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS runs (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        workflow_version  VARCHAR(50) NOT NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
        mode              VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft', 'auto')),
        input             JSONB NOT NULL,
        result            JSONB,
        app_id            UUID,
        app_action_id     VARCHAR(255),
        user_id           UUID,
        tenant_id         UUID NOT NULL,
        cost_limit_cents  INTEGER,
        llm_calls_limit   INTEGER,
        latency_slo_ms    INTEGER,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Steps
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

    // Events
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
            'run_started', 'run_completed', 'run_failed',
            'step_started', 'step_completed', 'step_failed',
            'tool_call', 'llm_call', 'policy_eval', 'error'
          )
        )
      );
    `);

    // ============================================
    // 3. Tools & Agents (with all Registry fields)
    // ============================================

    // Tools (with risk_level and side_effects)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id            VARCHAR(255) PRIMARY KEY,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        input_schema  JSONB NOT NULL,
        handler_type  VARCHAR(50),
        handler_config JSONB,
        risk_level    VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
        side_effects  TEXT[] NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Agents (with all Registry fields from the start)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id                        VARCHAR(255) PRIMARY KEY,
        name                      VARCHAR(255) NOT NULL,
        instructions              TEXT,
        model_profile             JSONB NOT NULL,
        allowed_tools             VARCHAR(255)[] DEFAULT '{}',
        
        -- Registry fields
        logline_agent_id          VARCHAR(50) UNIQUE,
        tenant_id                 UUID,
        app_id                    VARCHAR(255),
        description               TEXT,
        avatar_url                TEXT,
        
        -- Onboarding & Training
        onboarding_status         TEXT NOT NULL DEFAULT 'pending'
          CHECK (onboarding_status IN ('pending', 'in_training', 'trained', 'certified', 'suspended')),
        training_type             TEXT CHECK (training_type IN ('general', 'personalized', 'custom')),
        training_data             JSONB,
        training_completed_at     TIMESTAMPTZ,
        certified_by_logline_id   VARCHAR(50),
        
        -- Memory
        memory_enabled            BOOLEAN DEFAULT true,
        memory_scope              TEXT DEFAULT 'private'
          CHECK (memory_scope IN ('private', 'tenant', 'org', 'public')),
        
        -- Contracts
        active_contract_id        UUID,
        contract_scope            JSONB,
        
        -- Accountability
        created_by_logline_id     VARCHAR(50),
        owner_logline_id          VARCHAR(50),
        accountability_enabled    BOOLEAN DEFAULT true,
        
        -- Performance
        total_runs                INTEGER DEFAULT 0,
        successful_runs           INTEGER DEFAULT 0,
        failed_runs               INTEGER DEFAULT 0,
        avg_cost_per_run_cents    INTEGER,
        reputation_score          DECIMAL(3,2),
        
        -- Visibility
        visibility                TEXT NOT NULL DEFAULT 'tenant'
          CHECK (visibility IN ('tenant', 'org', 'public')),
        
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 4. App Layer
    // ============================================

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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_scopes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        app_id      VARCHAR(255) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        scope_type  VARCHAR(20) NOT NULL CHECK (scope_type IN ('tool', 'memory', 'external')),
        scope_value VARCHAR(255) NOT NULL,
        UNIQUE(app_id, scope_type, scope_value)
      );
    `);

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
    // 5. Files
    // ============================================

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
    // 6. Memory & RAG
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_items (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_type   VARCHAR(50) NOT NULL,
        owner_id     UUID NOT NULL,
        type         VARCHAR(50) NOT NULL,
        content      TEXT NOT NULL,
        metadata     JSONB,
        embedding    vector(1536),
        visibility   VARCHAR(20) NOT NULL DEFAULT 'private',
        ttl          TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT memory_items_owner_type_check CHECK (owner_type IN ('user', 'tenant', 'app', 'agent', 'run')),
        CONSTRAINT memory_items_type_check CHECK (type IN ('short_term', 'long_term', 'profile')),
        CONSTRAINT memory_items_visibility_check CHECK (visibility IN ('private', 'org', 'public'))
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        content       TEXT NOT NULL,
        metadata      JSONB,
        embedding     vector(1536),
        memory_item_id UUID REFERENCES memory_items(id) ON DELETE CASCADE,
        chunk_index   INTEGER DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 7. Policies
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS policies (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        scope       VARCHAR(50) NOT NULL CHECK (scope IN ('global', 'tenant', 'app', 'tool', 'workflow', 'agent')),
        scope_id    VARCHAR(255),
        rule_expr   JSONB NOT NULL,
        effect      VARCHAR(20) NOT NULL CHECK (effect IN ('allow', 'deny', 'require_approval', 'modify')),
        priority    INTEGER NOT NULL DEFAULT 100,
        enabled     BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 8. Auth
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email        TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        name         TEXT,
        avatar_url   TEXT,
        role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'developer')),
        tenant_id    UUID,
        logline_id   VARCHAR(50),
        metadata     JSONB,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

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

    // ============================================
    // 9. Audit & Alerts
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        action       TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id  UUID,
        changes      JSONB,
        ip_address   TEXT,
        user_agent   TEXT,
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alert_configs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT NOT NULL,
        description  TEXT,
        rule_type    TEXT NOT NULL CHECK (rule_type IN ('error_rate', 'budget_exceeded', 'policy_denials', 'memory_usage', 'rate_limit')),
        threshold    JSONB NOT NULL,
        enabled      BOOLEAN NOT NULL DEFAULT true,
        channels     JSONB NOT NULL DEFAULT '[]',
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_config_id UUID REFERENCES alert_configs(id) ON DELETE CASCADE,
        triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        value        JSONB NOT NULL,
        message      TEXT,
        resolved_at  TIMESTAMPTZ,
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 10. Registry: Core People
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core_people (
        logline_id      VARCHAR(50) PRIMARY KEY,
        cpf_hash        VARCHAR(255) UNIQUE,
        email_primary   VARCHAR(255) UNIQUE,
        name            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_people_relationships (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        logline_id      VARCHAR(50) NOT NULL REFERENCES core_people(logline_id) ON DELETE CASCADE,
        tenant_id       UUID NOT NULL,
        role            TEXT NOT NULL,
        tenant_specific_data JSONB,
        permissions     JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(logline_id, tenant_id)
      );
    `);

    // ============================================
    // 11. Registry: Objects
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_objects (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        object_type     TEXT NOT NULL CHECK (object_type IN ('document', 'file', 'merchandise', 'collection', 'lost_found', 'inventory', 'service')),
        tenant_id       UUID,
        app_id          VARCHAR(255),
        identifier      TEXT,
        name            TEXT NOT NULL,
        description     TEXT,
        metadata        JSONB,
        owner_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
        current_custodian_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
        location        TEXT,
        version         INTEGER DEFAULT 1,
        parent_object_id UUID REFERENCES registry_objects(id),
        lost_found_status TEXT,
        lost_found_reported_by VARCHAR(50) REFERENCES core_people(logline_id),
        lost_found_match_score DECIMAL(5,2),
        visibility      TEXT NOT NULL DEFAULT 'tenant',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_object_movements (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        object_id       UUID NOT NULL REFERENCES registry_objects(id) ON DELETE CASCADE,
        movement_type   TEXT NOT NULL,
        from_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
        to_logline_id   VARCHAR(50) REFERENCES core_people(logline_id),
        from_location   TEXT,
        to_location     TEXT,
        quantity        INTEGER,
        reason          TEXT,
        metadata        JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 12. Registry: Ideas & Contracts (with INTEGER money fields)
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_ideas (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        app_id          VARCHAR(255),
        titulo          TEXT NOT NULL,
        descricao       TEXT,
        autor_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id) ON DELETE CASCADE,
        prioridade_autor INTEGER NOT NULL CHECK (prioridade_autor >= 1 AND prioridade_autor <= 10),
        prioridade_consensual DECIMAL(4,2),
        custo_estimado_cents INTEGER,
        moeda           VARCHAR(3) DEFAULT 'BRL',
        status          TEXT NOT NULL DEFAULT 'aguardando_votos',
        parent_idea_id  UUID REFERENCES registry_ideas(id),
        contract_id     UUID,
        custo_real_cents INTEGER,
        impacto_real    TEXT,
        aprendizados    TEXT,
        periodo_votacao_dias INTEGER DEFAULT 7,
        data_submissao  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data_fim_votacao TIMESTAMPTZ,
        data_aprovacao  TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_idea_votes (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        idea_id         UUID NOT NULL REFERENCES registry_ideas(id) ON DELETE CASCADE,
        voter_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id) ON DELETE CASCADE,
        prioridade      INTEGER NOT NULL CHECK (prioridade >= 1 AND prioridade <= 10),
        comentario      TEXT,
        peso            DECIMAL(3,2) DEFAULT 1.0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(idea_id, voter_logline_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_contracts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        app_id          VARCHAR(255),
        tipo            TEXT NOT NULL,
        autor_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
        contraparte_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
        testemunha_logline_id VARCHAR(50) REFERENCES core_people(logline_id) ON DELETE SET NULL,
        titulo          TEXT NOT NULL,
        descricao       TEXT,
        escopo          JSONB,
        data_inicio     DATE,
        prazo_dias      INTEGER,
        data_limite     DATE,
        valor_total_cents INTEGER,
        moeda           VARCHAR(3) DEFAULT 'BRL',
        forma_pagamento TEXT,
        multa_atraso    JSONB,
        clausulas       JSONB,
        estado_atual    TEXT NOT NULL DEFAULT 'RASCUNHO',
        idea_id         UUID REFERENCES registry_ideas(id),
        parent_contract_id UUID REFERENCES registry_contracts(id),
        despacho_tipo   TEXT,
        despacho_config JSONB,
        questionamento_razao TEXT,
        questionamento_data TIMESTAMPTZ,
        periodo_defesa_dias INTEGER DEFAULT 3,
        justificativa   TEXT,
        justificativa_aceita BOOLEAN,
        penalidade_aplicada_cents INTEGER,
        penalidade_data TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_contract_state_history (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id     UUID NOT NULL REFERENCES registry_contracts(id) ON DELETE CASCADE,
        estado_anterior TEXT,
        estado_novo     TEXT NOT NULL,
        motivo          TEXT,
        changed_by_logline_id VARCHAR(50),
        metadata        JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_contract_templates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        titulo          VARCHAR(255) NOT NULL,
        descricao       TEXT,
        template_data   JSONB NOT NULL,
        required_variables JSONB NOT NULL DEFAULT '[]',
        categoria       VARCHAR(100),
        versao          INTEGER DEFAULT 1,
        ativo           BOOLEAN DEFAULT true,
        created_by_logline_id VARCHAR(50),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 13. Registry: Relationships
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_relationships (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type     TEXT NOT NULL,
        source_id       TEXT NOT NULL,
        target_type     TEXT NOT NULL,
        target_id       TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        metadata        JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 14. Registry: Agent Training & Evaluation
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_agent_training_history (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id        VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        training_type   TEXT NOT NULL,
        training_data   JSONB,
        trained_by_logline_id VARCHAR(50) REFERENCES core_people(logline_id) ON DELETE SET NULL,
        result          TEXT,
        performance_metrics JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_agent_evaluations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id        VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        evaluator_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id) ON DELETE CASCADE,
        run_id          UUID,
        rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        evaluation      TEXT,
        criteria        JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_agent_execution_logs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id        VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        execution_id    VARCHAR(255) NOT NULL,
        started_at      TIMESTAMPTZ NOT NULL,
        finished_at     TIMESTAMPTZ,
        status          VARCHAR(50) NOT NULL,
        total_steps     INTEGER,
        tools_used      JSONB,
        cost_cents      INTEGER,
        input_summary   TEXT,
        output_summary  TEXT,
        error_message   TEXT,
        error_stack     TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // 15. Foreign Keys (Registry)
    // ============================================

    // Users -> Core People
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_users_logline_id
      FOREIGN KEY (logline_id)
      REFERENCES core_people(logline_id)
      ON DELETE SET NULL;
    `);

    // Ideas -> Contracts
    await queryRunner.query(`
      ALTER TABLE registry_ideas
      ADD CONSTRAINT fk_idea_contract FOREIGN KEY (contract_id) 
      REFERENCES registry_contracts(id) ON DELETE SET NULL;
    `);

    // Agents -> Contracts
    await queryRunner.query(`
      ALTER TABLE agents
      ADD CONSTRAINT fk_agents_active_contract
      FOREIGN KEY (active_contract_id)
      REFERENCES registry_contracts(id)
      ON DELETE SET NULL;
    `);

    // Agents -> Core People
    await queryRunner.query(`
      ALTER TABLE agents
      ADD CONSTRAINT fk_agents_owner
      FOREIGN KEY (owner_logline_id)
      REFERENCES core_people(logline_id)
      ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE agents
      ADD CONSTRAINT fk_agents_creator
      FOREIGN KEY (created_by_logline_id)
      REFERENCES core_people(logline_id)
      ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE agents
      ADD CONSTRAINT fk_agents_certifier
      FOREIGN KEY (certified_by_logline_id)
      REFERENCES core_people(logline_id)
      ON DELETE SET NULL;
    `);

    // ============================================
    // 16. Indexes
    // ============================================

    // Core Execution
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_app ON runs(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_tenant ON runs(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_steps_node ON steps(node_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, ts);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_step ON events(step_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);`);

    // Tools & Agents
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tools_risk_level ON tools(risk_level);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agents_logline_id ON agents(logline_agent_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agents_contract ON agents(active_contract_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agents_onboarding ON agents(onboarding_status);`);

    // Apps
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_app_scopes_app ON app_scopes(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_app_workflows_app ON app_workflows(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_app_actions_app ON app_actions(app_id);`);

    // Files
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_files_run ON files(run_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_files_app ON files(app_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);`);

    // Memory
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_memory_owner ON memory_items(owner_type, owner_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_items(owner_type, owner_id, type);`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_items 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_resources_memory ON resources(memory_item_id);`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_resources_embedding ON resources 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);

    // Policies
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_policies_scope ON policies(scope, scope_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled, priority);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_policies_effect ON policies(effect);`);

    // Auth
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_logline_id ON users(logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);`);

    // Audit & Alerts
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alert_configs_tenant ON alert_configs(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled, rule_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alert_history_config ON alert_history(alert_config_id, triggered_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON alert_history(tenant_id, triggered_at);`);

    // Registry: People
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_core_people_cpf_hash ON core_people(cpf_hash);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_core_people_email ON core_people(email_primary);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_people_tenant ON tenant_people_relationships(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tenant_people_role ON tenant_people_relationships(tenant_id, role);`);

    // Registry: Objects
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_objects_type ON registry_objects(object_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_objects_tenant ON registry_objects(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_objects_identifier ON registry_objects(identifier);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_objects_owner ON registry_objects(owner_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_objects_custodian ON registry_objects(current_custodian_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_objects_lost_found ON registry_objects(lost_found_status) WHERE lost_found_status IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_object_movements_object ON registry_object_movements(object_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_object_movements_type ON registry_object_movements(movement_type);`);

    // Registry: Ideas & Contracts
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_ideas_tenant ON registry_ideas(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_ideas_status ON registry_ideas(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_ideas_prioridade ON registry_ideas(prioridade_consensual DESC NULLS LAST);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_ideas_autor ON registry_ideas(autor_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON registry_idea_votes(idea_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_idea_votes_voter ON registry_idea_votes(voter_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_contracts_tenant ON registry_contracts(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_contracts_estado ON registry_contracts(estado_atual);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_contracts_autor ON registry_contracts(autor_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_registry_contracts_contraparte ON registry_contracts(contraparte_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_contract_history_contract ON registry_contract_state_history(contract_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_contract_templates_tenant ON registry_contract_templates(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_contract_templates_categoria ON registry_contract_templates(categoria);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_contract_templates_ativo ON registry_contract_templates(ativo) WHERE ativo = true;`);

    // Registry: Relationships
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_relationships_source ON registry_relationships(source_type, source_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_relationships_target ON registry_relationships(target_type, target_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_relationships_type ON registry_relationships(relationship_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_relationships_bidirectional ON registry_relationships(source_type, target_type, relationship_type);`);

    // Registry: Agent Training & Evaluation
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_training_agent ON registry_agent_training_history(agent_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_evaluations_agent ON registry_agent_evaluations(agent_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_evaluations_evaluator ON registry_agent_evaluations(evaluator_logline_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent ON registry_agent_execution_logs(agent_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_started ON registry_agent_execution_logs(started_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_status ON registry_agent_execution_logs(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_status ON registry_agent_execution_logs(agent_id, status);`);

    // ============================================
    // 17. Seed Default Data
    // ============================================

    // Built-in Tools
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'natural_language_db_read',
        'Natural Language DB Read',
        'Query the database using natural language. READ-ONLY operations. Converts your question to SQL SELECT queries.',
        '{"type":"object","properties":{"query":{"type":"string","description":"Natural language question about the database"}},"required":["query"]}'::jsonb,
        'builtin',
        '{"handler": "natural_language_db_read"}'::jsonb,
        'medium',
        ARRAY['database_read']::text[],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        updated_at = NOW();
    `);

    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'natural_language_db_write',
        'Natural Language DB Write',
        'Write to the database using natural language. Supports INSERT and UPDATE operations. Requires explicit confirmation (dryRun=false, confirm=true).',
        '{"type":"object","properties":{"instruction":{"type":"string","description":"Natural language instruction for the write operation"},"dryRun":{"type":"boolean","description":"If true, return SQL without executing (default: true)","default":true},"confirm":{"type":"boolean","description":"If true, execute the SQL (requires dryRun=false)","default":false}},"required":["instruction"]}'::jsonb,
        'builtin',
        '{"handler": "natural_language_db_write"}'::jsonb,
        'high',
        ARRAY['database_write', 'data_modification']::text[],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        updated_at = NOW();
    `);

    // Memory Tools
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES 
      ('memory.store', 'Store Memory', 'Store a memory item for later retrieval.', '{"type":"object","properties":{"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"]},"owner_id":{"type":"string"},"type":{"type":"string","enum":["short_term","long_term","profile"]},"content":{"type":"string"},"metadata":{"type":"object"},"visibility":{"type":"string","enum":["private","org","public"],"default":"private"},"ttl":{"type":"string","format":"date-time"}},"required":["owner_type","owner_id","type","content"]}'::jsonb, 'builtin', '{"handler": "memory.store"}'::jsonb, 'low', ARRAY['memory_storage']::text[], NOW(), NOW()),
      ('memory.retrieve', 'Retrieve Memory', 'Retrieve memories by owner.', '{"type":"object","properties":{"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"]},"owner_id":{"type":"string"},"type":{"type":"string","enum":["short_term","long_term","profile"]},"limit":{"type":"number","default":50,"minimum":1,"maximum":100}},"required":["owner_type","owner_id"]}'::jsonb, 'builtin', '{"handler": "memory.retrieve"}'::jsonb, 'low', ARRAY['memory_storage']::text[], NOW(), NOW()),
      ('memory.search', 'Search Memory', 'Semantically search memories using natural language.', '{"type":"object","properties":{"query":{"type":"string"},"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"]},"owner_id":{"type":"string"},"type":{"type":"string","enum":["short_term","long_term","profile"]},"limit":{"type":"number","default":10,"minimum":1,"maximum":50},"threshold":{"type":"number","default":0.7,"minimum":0,"maximum":1}},"required":["query"]}'::jsonb, 'builtin', '{"handler": "memory.search"}'::jsonb, 'low', ARRAY['memory_storage']::text[], NOW(), NOW()),
      ('memory.delete', 'Delete Memory', 'Delete a memory item by ID.', '{"type":"object","properties":{"memory_id":{"type":"string"},"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"]},"owner_id":{"type":"string"}},"required":["memory_id","owner_type","owner_id"]}'::jsonb, 'builtin', '{"handler": "memory.delete"}'::jsonb, 'low', ARRAY['memory_storage']::text[], NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        updated_at = NOW();
    `);

    // Registry Tools
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES 
      ('registry_lookup_person', 'Registry: Lookup Person', 'Resolve a person identity by LogLine ID, CPF, or Email.', '{"type":"object","properties":{"logline_id":{"type":"string"},"cpf":{"type":"string"},"email":{"type":"string"}},"anyOf":[{"required":["logline_id"]},{"required":["cpf"]},{"required":["email"]}]}'::jsonb, 'builtin', '{"handler": "registry_lookup_person"}'::jsonb, 'low', ARRAY['database_read']::text[], NOW(), NOW()),
      ('registry_get_contract', 'Registry: Get Contract', 'Get details and status of a contract.', '{"type":"object","properties":{"contract_id":{"type":"string"}},"required":["contract_id"]}'::jsonb, 'builtin', '{"handler": "registry_get_contract"}'::jsonb, 'low', ARRAY['database_read']::text[], NOW(), NOW()),
      ('registry_check_object', 'Registry: Check Object', 'Check status, location and custody of a registry object.', '{"type":"object","properties":{"object_id":{"type":"string"}},"required":["object_id"]}'::jsonb, 'builtin', '{"handler": "registry_check_object"}'::jsonb, 'low', ARRAY['database_read']::text[], NOW(), NOW()),
      ('registry_search_ideas', 'Registry: Search Ideas', 'Search for ideas based on status.', '{"type":"object","properties":{"tenant_id":{"type":"string"},"status":{"type":"string","enum":["aguardando_votos","em_votacao","aprovada","rejeitada","adiada","em_execucao","concluida"]},"autor_logline_id":{"type":"string"},"sort":{"type":"string","enum":["prioridade_consensual","custo_estimado","data_submissao"]},"limit":{"type":"number","default":10},"page":{"type":"number","default":1}},"required":["tenant_id"]}'::jsonb, 'builtin', '{"handler": "registry_search_ideas"}'::jsonb, 'low', ARRAY['database_read']::text[], NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        updated_at = NOW();
    `);

    // Standard Library Tools
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES 
      ('http_request', 'HTTP Request', 'Make generic HTTP requests (GET, POST, PUT, DELETE, PATCH).', '{"type":"object","properties":{"method":{"type":"string","enum":["GET","POST","PUT","DELETE","PATCH"]},"url":{"type":"string","format":"uri"},"headers":{"type":"object","additionalProperties":{"type":"string"}},"body":{"type":"object"}},"required":["method","url"]}'::jsonb, 'builtin', '{"handler": "http_request"}'::jsonb, 'high', ARRAY['external_api_call']::text[], NOW(), NOW()),
      ('github_api', 'GitHub API', 'Interact with GitHub API to manage repositories, issues, and PRs.', '{"type":"object","properties":{"operation":{"type":"string","enum":["get_issue","create_issue","get_pr","list_repos","get_file_content"]},"owner":{"type":"string"},"repo":{"type":"string"},"issue_number":{"type":"number"},"title":{"type":"string"},"body":{"type":"string"},"path":{"type":"string"},"ref":{"type":"string"}},"required":["operation"]}'::jsonb, 'builtin', '{"handler": "github_api"}'::jsonb, 'medium', ARRAY['external_api_call']::text[], NOW(), NOW()),
      ('math_calculate', 'Math Calculator', 'Evaluate mathematical expressions safely.', '{"type":"object","properties":{"expression":{"type":"string","description":"Math expression to evaluate"}},"required":["expression"]}'::jsonb, 'builtin', '{"handler": "math_calculate"}'::jsonb, 'low', ARRAY[]::text[], NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        updated_at = NOW();
    `);

    // Default Router Agents
    await queryRunner.query(`
      INSERT INTO agents (id, name, instructions, model_profile, allowed_tools, created_at, updated_at)
      VALUES 
      ('agent.router', 'Router Agent', 'You are a routing agent. Your job is to analyze the output from previous workflow steps and determine which route to take based on the available options. Respond with ONLY the route ID (e.g., "high_priority" or "normal"). Do not include any explanation or additional text.', '{"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 50}'::jsonb, ARRAY[]::varchar[], NOW(), NOW()),
      ('agent.condition_evaluator', 'Condition Evaluator Agent', 'You are a condition evaluator. Your job is to analyze step output and determine which condition is true. Respond with ONLY the number (1, 2, 3, etc.) of the condition that is true. If none are true, respond with "0". Do not include any explanation.', '{"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 10}'::jsonb, ARRAY[]::varchar[], NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✅ Initial schema and default data created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order (respecting foreign key dependencies)
    // This is a complete teardown - use with caution!
    
    // Registry Agent tables
    await queryRunner.query(`DROP TABLE IF EXISTS registry_agent_execution_logs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_agent_evaluations CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_agent_training_history CASCADE;`);
    
    // Registry Relationships
    await queryRunner.query(`DROP TABLE IF EXISTS registry_relationships CASCADE;`);
    
    // Registry Contracts
    await queryRunner.query(`DROP TABLE IF EXISTS registry_contract_state_history CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_contract_templates CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_contracts CASCADE;`);
    
    // Registry Ideas
    await queryRunner.query(`DROP TABLE IF EXISTS registry_idea_votes CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_ideas CASCADE;`);
    
    // Registry Objects
    await queryRunner.query(`DROP TABLE IF EXISTS registry_object_movements CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_objects CASCADE;`);
    
    // Registry People
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_people_relationships CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS core_people CASCADE;`);
    
    // Alerts
    await queryRunner.query(`DROP TABLE IF EXISTS alert_history CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS alert_configs CASCADE;`);
    
    // Audit
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs CASCADE;`);
    
    // Auth
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE;`);
    
    // Policies
    await queryRunner.query(`DROP TABLE IF EXISTS policies CASCADE;`);
    
    // Memory
    await queryRunner.query(`DROP TABLE IF EXISTS resources CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS memory_items CASCADE;`);
    
    // Files
    await queryRunner.query(`DROP TABLE IF EXISTS files CASCADE;`);
    
    // Apps
    await queryRunner.query(`DROP TABLE IF EXISTS app_actions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_workflows CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_scopes CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS apps CASCADE;`);
    
    // Agents & Tools
    await queryRunner.query(`DROP TABLE IF EXISTS agents CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tools CASCADE;`);
    
    // Core Execution
    await queryRunner.query(`DROP TABLE IF EXISTS events CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS steps CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS runs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS workflows CASCADE;`);
    
    console.log('✅ All tables dropped');
  }
}

