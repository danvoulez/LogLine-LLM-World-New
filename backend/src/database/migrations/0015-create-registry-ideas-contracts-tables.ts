import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0015: Create Registry Ideas and Contracts Tables
 * 
 * This migration creates tables for:
 * - registry_ideas: Collaborative voting system for budget democracy
 * - registry_idea_votes: Votes on ideas
 * - registry_contracts: Executable state machine-based agreements
 * - registry_contract_state_history: State transition history
 * 
 * IMPORTANT: This migration must run AFTER 0014 (create-registry-agents-tables)
 */
export class CreateRegistryIdeasContractsTables1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Registry Ideas - Budget Democracy
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_ideas (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        app_id          VARCHAR(255),
        
        -- Conteúdo
        titulo          TEXT NOT NULL,
        descricao       TEXT,
        autor_logline_id VARCHAR(50) NOT NULL,
        
        -- Priorização
        prioridade_autor INTEGER NOT NULL CHECK (prioridade_autor >= 1 AND prioridade_autor <= 10),
        prioridade_consensual DECIMAL(4,2),
        
        -- Financeiro
        custo_estimado  DECIMAL(12,2),
        moeda           VARCHAR(3) DEFAULT 'BRL',
        
        -- Status
        status          TEXT NOT NULL DEFAULT 'aguardando_votos',
        
        -- Relacionamentos
        parent_idea_id  UUID REFERENCES registry_ideas(id),
        contract_id     UUID, -- FK will be added when contracts table exists
        
        -- Retrospectiva
        custo_real      DECIMAL(12,2),
        impacto_real    TEXT,
        aprendizados    TEXT,
        
        -- Configuração
        periodo_votacao_dias INTEGER DEFAULT 7,
        data_submissao  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data_fim_votacao TIMESTAMPTZ,
        data_aprovacao  TIMESTAMPTZ,
        
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_ideas_tenant ON registry_ideas(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_ideas_status ON registry_ideas(status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_ideas_prioridade ON registry_ideas(prioridade_consensual DESC NULLS LAST);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_ideas_autor ON registry_ideas(autor_logline_id);
    `);

    // Votes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_idea_votes (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        idea_id         UUID NOT NULL REFERENCES registry_ideas(id) ON DELETE CASCADE,
        voter_logline_id VARCHAR(50) NOT NULL,
        prioridade      INTEGER NOT NULL CHECK (prioridade >= 1 AND prioridade <= 10),
        comentario      TEXT,
        peso            DECIMAL(3,2) DEFAULT 1.0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(idea_id, voter_logline_id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON registry_idea_votes(idea_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_idea_votes_voter ON registry_idea_votes(voter_logline_id);
    `);

    // ============================================
    // Registry Contracts - Executable Agreements
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_contracts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        app_id          VARCHAR(255),
        
        -- Tipo
        tipo            TEXT NOT NULL,
        
        -- Partes
        autor_logline_id VARCHAR(50) NOT NULL,
        contraparte_logline_id VARCHAR(50) NOT NULL,
        testemunha_logline_id VARCHAR(50),
        
        -- Conteúdo
        titulo          TEXT NOT NULL,
        descricao       TEXT,
        escopo          JSONB,
        data_inicio     DATE,
        prazo_dias      INTEGER,
        data_limite     DATE,
        
        -- Financeiro
        valor_total     DECIMAL(12,2),
        moeda           VARCHAR(3) DEFAULT 'BRL',
        forma_pagamento TEXT,
        multa_atraso    JSONB,
        
        -- Cláusulas
        clausulas       JSONB,
        
        -- Estado
        estado_atual    TEXT NOT NULL DEFAULT 'RASCUNHO',
        
        -- Relacionamentos
        idea_id         UUID REFERENCES registry_ideas(id),
        parent_contract_id UUID REFERENCES registry_contracts(id),
        
        -- Despacho
        despacho_tipo   TEXT,
        despacho_config JSONB,
        
        -- Questionamento
        questionamento_razao TEXT,
        questionamento_data TIMESTAMPTZ,
        periodo_defesa_dias INTEGER DEFAULT 3,
        justificativa   TEXT,
        justificativa_aceita BOOLEAN,
        
        -- Penalidade
        penalidade_aplicada DECIMAL(12,2),
        penalidade_data TIMESTAMPTZ,
        
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_contracts_tenant ON registry_contracts(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_contracts_estado ON registry_contracts(estado_atual);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_contracts_autor ON registry_contracts(autor_logline_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_contracts_contraparte ON registry_contracts(contraparte_logline_id);
    `);

    // Add FK constraint for contract_id in ideas (after contracts table exists)
    await queryRunner.query(`
      ALTER TABLE registry_ideas
        ADD CONSTRAINT fk_idea_contract FOREIGN KEY (contract_id) 
        REFERENCES registry_contracts(id) ON DELETE SET NULL;
    `);

    // State History
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
      CREATE INDEX IF NOT EXISTS idx_contract_history_contract ON registry_contract_state_history(contract_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order (respecting foreign key dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS registry_contract_state_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_idea_votes;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_ideas;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_contracts;`);
  }
}

