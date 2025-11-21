import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0016: Create Registry Relationships Table
 * 
 * This migration creates a generic relationships table for linking any entities
 * in the Registry (People, Agents, Objects, Ideas, Contracts, Apps).
 * 
 * IMPORTANT: This migration must run AFTER 0015 (create-registry-ideas-contracts-tables)
 */
export class CreateRegistryRelationshipsTable1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Generic Relationships Table
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

    // Indexes for efficient queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON registry_relationships(source_type, source_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON registry_relationships(target_type, target_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_relationships_type ON registry_relationships(relationship_type);
    `);

    // Composite index for bidirectional lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_relationships_bidirectional ON registry_relationships(source_type, target_type, relationship_type);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS registry_relationships;`);
  }
}

