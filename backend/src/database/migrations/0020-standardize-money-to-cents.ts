import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0020: Standardize Money to Cents (Integer)
 * 
 * Refactors all monetary fields to use INTEGER representing the smallest unit (cents),
 * eliminating floating point ambiguity for LLMs and ensuring financial precision.
 * 
 * Changes:
 * - registry_ideas: custo_estimado -> custo_estimado_cents (DECIMAL -> INTEGER)
 * - registry_ideas: custo_real -> custo_real_cents (DECIMAL -> INTEGER)
 * - registry_contracts: valor_total -> valor_total_cents (DECIMAL -> INTEGER)
 * - registry_contracts: penalidade_aplicada -> penalidade_aplicada_cents (DECIMAL -> INTEGER)
 * - agents: avg_cost_per_run_cents (DECIMAL -> INTEGER)
 */
export class StandardizeMoneyToCents1700000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Registry Ideas
    // ============================================
    
    // custo_estimado -> custo_estimado_cents
    await queryRunner.query(`
      ALTER TABLE registry_ideas
      ADD COLUMN custo_estimado_cents INTEGER;
    `);
    
    // Migrate data (multiply by 100)
    await queryRunner.query(`
      UPDATE registry_ideas 
      SET custo_estimado_cents = CAST(custo_estimado * 100 AS INTEGER)
      WHERE custo_estimado IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE registry_ideas
      DROP COLUMN custo_estimado;
    `);

    // custo_real -> custo_real_cents
    await queryRunner.query(`
      ALTER TABLE registry_ideas
      ADD COLUMN custo_real_cents INTEGER;
    `);

    await queryRunner.query(`
      UPDATE registry_ideas 
      SET custo_real_cents = CAST(custo_real * 100 AS INTEGER)
      WHERE custo_real IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE registry_ideas
      DROP COLUMN custo_real;
    `);

    // ============================================
    // Registry Contracts
    // ============================================

    // valor_total -> valor_total_cents
    await queryRunner.query(`
      ALTER TABLE registry_contracts
      ADD COLUMN valor_total_cents INTEGER;
    `);

    await queryRunner.query(`
      UPDATE registry_contracts 
      SET valor_total_cents = CAST(valor_total * 100 AS INTEGER)
      WHERE valor_total IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE registry_contracts
      DROP COLUMN valor_total;
    `);

    // penalidade_aplicada -> penalidade_aplicada_cents
    await queryRunner.query(`
      ALTER TABLE registry_contracts
      ADD COLUMN penalidade_aplicada_cents INTEGER;
    `);

    await queryRunner.query(`
      UPDATE registry_contracts 
      SET penalidade_aplicada_cents = CAST(penalidade_aplicada * 100 AS INTEGER)
      WHERE penalidade_aplicada IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE registry_contracts
      DROP COLUMN penalidade_aplicada;
    `);

    // ============================================
    // Agents
    // ============================================

    // avg_cost_per_run_cents (Already named cents, but type is DECIMAL)
    // We need to convert type in place or via temp column
    await queryRunner.query(`
      ALTER TABLE agents
      ALTER COLUMN avg_cost_per_run_cents TYPE INTEGER 
      USING CAST(avg_cost_per_run_cents AS INTEGER);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert Agents
    await queryRunner.query(`
      ALTER TABLE agents
      ALTER COLUMN avg_cost_per_run_cents TYPE DECIMAL(12,2);
    `);

    // Revert Contracts
    await queryRunner.query(`
      ALTER TABLE registry_contracts
      ADD COLUMN penalidade_aplicada DECIMAL(12,2);
    `);
    await queryRunner.query(`
      UPDATE registry_contracts
      SET penalidade_aplicada = CAST(penalidade_aplicada_cents AS DECIMAL) / 100;
    `);
    await queryRunner.query(`ALTER TABLE registry_contracts DROP COLUMN penalidade_aplicada_cents;`);

    await queryRunner.query(`
      ALTER TABLE registry_contracts
      ADD COLUMN valor_total DECIMAL(12,2);
    `);
    await queryRunner.query(`
      UPDATE registry_contracts
      SET valor_total = CAST(valor_total_cents AS DECIMAL) / 100;
    `);
    await queryRunner.query(`ALTER TABLE registry_contracts DROP COLUMN valor_total_cents;`);

    // Revert Ideas
    await queryRunner.query(`
      ALTER TABLE registry_ideas
      ADD COLUMN custo_real DECIMAL(12,2);
    `);
    await queryRunner.query(`
      UPDATE registry_ideas
      SET custo_real = CAST(custo_real_cents AS DECIMAL) / 100;
    `);
    await queryRunner.query(`ALTER TABLE registry_ideas DROP COLUMN custo_real_cents;`);

    await queryRunner.query(`
      ALTER TABLE registry_ideas
      ADD COLUMN custo_estimado DECIMAL(12,2);
    `);
    await queryRunner.query(`
      UPDATE registry_ideas
      SET custo_estimado = CAST(custo_estimado_cents AS DECIMAL) / 100;
    `);
    await queryRunner.query(`ALTER TABLE registry_ideas DROP COLUMN custo_estimado_cents;`);
  }
}

