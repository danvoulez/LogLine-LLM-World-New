import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0013: Create Registry Core Tables
 * 
 * This migration creates the foundational tables for the Universal Registry:
 * - core_people: Universal identity (LogLine ID) for people
 * - tenant_people_relationships: Tenant-specific relationships with people
 * - registry_objects: Trackable inanimate objects (documents, files, merchandise, etc.)
 * - registry_object_movements: History of object movements/transfers
 * 
 * IMPORTANT: This migration must run AFTER 0012 (add-tool-risk-level)
 */
export class CreateRegistryCoreTables1700000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Core People - Universal Identity
    // ============================================

    // Core People: Universal identity (Cross-App)
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
      CREATE INDEX IF NOT EXISTS idx_core_people_cpf_hash ON core_people(cpf_hash);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_core_people_email ON core_people(email_primary);
    `);

    // Tenant People Relationships: Tenant-specific data (Isolated)
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_people_tenant ON tenant_people_relationships(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_people_role ON tenant_people_relationships(tenant_id, role);
    `);

    // ============================================
    // Registry Objects - Trackable Inanimate Items
    // ============================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_objects (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        object_type     TEXT NOT NULL CHECK (object_type IN ('document', 'file', 'merchandise', 'collection', 'lost_found', 'inventory', 'service')),
        tenant_id       UUID,
        app_id          VARCHAR(255),
        
        -- Identificação
        identifier      TEXT,
        name            TEXT NOT NULL,
        description     TEXT,
        
        -- Dados específicos por tipo (JSONB flexível)
        metadata        JSONB,
        
        -- Rastreabilidade
        owner_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
        current_custodian_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
        location        TEXT,
        
        -- Versionamento (para arquivos)
        version         INTEGER DEFAULT 1,
        parent_object_id UUID REFERENCES registry_objects(id),
        
        -- Lost & Found específico
        lost_found_status TEXT,
        lost_found_reported_by VARCHAR(50) REFERENCES core_people(logline_id),
        lost_found_match_score DECIMAL(5,2),
        
        -- Visibilidade
        visibility      TEXT NOT NULL DEFAULT 'tenant',
        
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_objects_type ON registry_objects(object_type);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_objects_tenant ON registry_objects(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_objects_identifier ON registry_objects(identifier);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_objects_owner ON registry_objects(owner_logline_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_objects_custodian ON registry_objects(current_custodian_logline_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_registry_objects_lost_found ON registry_objects(lost_found_status) WHERE lost_found_status IS NOT NULL;
    `);

    // Histórico de Movimentação
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_object_movements_object ON registry_object_movements(object_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_object_movements_type ON registry_object_movements(movement_type);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order (respecting foreign key dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS registry_object_movements;`);
    await queryRunner.query(`DROP TABLE IF EXISTS registry_objects;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_people_relationships;`);
    await queryRunner.query(`DROP TABLE IF EXISTS core_people;`);
  }
}

