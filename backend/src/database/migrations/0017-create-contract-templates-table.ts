import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0017: Create Contract Templates Table
 * 
 * This migration creates the contract templates table for standardizing
 * contract creation across tenants.
 * 
 * IMPORTANT: This migration must run AFTER 0015 (create-registry-ideas-contracts-tables)
 */
export class CreateContractTemplatesTable1700000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_contract_templates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        
        titulo          VARCHAR(255) NOT NULL,
        descricao       TEXT,
        
        -- Template como JSON com variáveis
        template_data   JSONB NOT NULL,
        
        -- Variáveis que devem ser preenchidas
        required_variables JSONB NOT NULL DEFAULT '[]',
        
        categoria       VARCHAR(100),
        versao          INTEGER DEFAULT 1,
        ativo           BOOLEAN DEFAULT true,
        
        created_by_logline_id VARCHAR(50),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_templates_tenant ON registry_contract_templates(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_templates_categoria ON registry_contract_templates(categoria);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_templates_ativo ON registry_contract_templates(ativo) WHERE ativo = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS registry_contract_templates;`);
  }
}

