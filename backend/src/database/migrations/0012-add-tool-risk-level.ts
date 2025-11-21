import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0012: Add risk_level and side_effects to tools table
 * 
 * This migration adds governance fields to the tools table:
 * - risk_level: 'low' | 'medium' | 'high' (default: 'low')
 * - side_effects: array of strings describing side effects
 * 
 * These fields are used by Policy Engine v1 to enforce governance rules.
 */
export class AddToolRiskLevel1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add risk_level column
    await queryRunner.query(`
      ALTER TABLE tools
        ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) NOT NULL DEFAULT 'low'
          CHECK (risk_level IN ('low', 'medium', 'high'));
    `);

    // Add side_effects column (array of strings)
    await queryRunner.query(`
      ALTER TABLE tools
        ADD COLUMN IF NOT EXISTS side_effects TEXT[] NOT NULL DEFAULT '{}';
    `);

    // Create index for risk_level (used in policy queries)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tools_risk_level ON tools(risk_level);
    `);

    // Update existing built-in tools with appropriate risk levels
    await queryRunner.query(`
      UPDATE tools
      SET risk_level = 'medium', side_effects = ARRAY['database_read']
      WHERE id = 'natural_language_db_read';
    `);

    await queryRunner.query(`
      UPDATE tools
      SET risk_level = 'high', side_effects = ARRAY['database_write', 'data_modification']
      WHERE id = 'natural_language_db_write';
    `);

    // Memory tools are generally low risk
    await queryRunner.query(`
      UPDATE tools
      SET risk_level = 'low', side_effects = ARRAY['memory_storage']
      WHERE id LIKE 'memory.%';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_tools_risk_level;
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE tools
        DROP COLUMN IF EXISTS side_effects,
        DROP COLUMN IF EXISTS risk_level;
    `);
  }
}

