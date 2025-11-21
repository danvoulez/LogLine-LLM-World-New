import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0019: Fix Registry Foreign Keys
 * 
 * This migration adds missing foreign key constraints to ensure referential integrity
 * across the Universal Registry. Ideally these should have been in the original migrations,
 * but we are adding them now to enforce correctness.
 * 
 * Relationships enforced:
 * - Registry Ideas -> Core People (Author)
 * - Registry Idea Votes -> Core People (Voter)
 * - Registry Contracts -> Core People (Author, Counterparty, Witness)
 * - Agents -> Registry Contracts (Active Contract)
 * - Agents -> Core People (Owner, Creator, Certifier)
 * - Agent Evaluations -> Core People (Evaluator)
 * - Agent Training History -> Core People (Trainer)
 */
export class FixRegistryForeignKeys1700000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // Registry Ideas & Votes
    // ============================================

    // Ideas -> Author
    await queryRunner.query(`
      ALTER TABLE registry_ideas
        ADD CONSTRAINT fk_registry_ideas_author
        FOREIGN KEY (autor_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE CASCADE;
    `);

    // Votes -> Voter
    await queryRunner.query(`
      ALTER TABLE registry_idea_votes
        ADD CONSTRAINT fk_registry_idea_votes_voter
        FOREIGN KEY (voter_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE CASCADE;
    `);

    // ============================================
    // Registry Contracts
    // ============================================

    // Contract -> Author
    await queryRunner.query(`
      ALTER TABLE registry_contracts
        ADD CONSTRAINT fk_registry_contracts_author
        FOREIGN KEY (autor_logline_id)
        REFERENCES core_people(logline_id);
    `);

    // Contract -> Counterparty
    await queryRunner.query(`
      ALTER TABLE registry_contracts
        ADD CONSTRAINT fk_registry_contracts_counterparty
        FOREIGN KEY (contraparte_logline_id)
        REFERENCES core_people(logline_id);
    `);

    // Contract -> Witness
    await queryRunner.query(`
      ALTER TABLE registry_contracts
        ADD CONSTRAINT fk_registry_contracts_witness
        FOREIGN KEY (testemunha_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE SET NULL;
    `);

    // ============================================
    // Agents
    // ============================================

    // Agent -> Active Contract
    await queryRunner.query(`
      ALTER TABLE agents
        ADD CONSTRAINT fk_agents_active_contract
        FOREIGN KEY (active_contract_id)
        REFERENCES registry_contracts(id)
        ON DELETE SET NULL;
    `);

    // Agent -> Owner
    await queryRunner.query(`
      ALTER TABLE agents
        ADD CONSTRAINT fk_agents_owner
        FOREIGN KEY (owner_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE SET NULL;
    `);

    // Agent -> Creator
    await queryRunner.query(`
      ALTER TABLE agents
        ADD CONSTRAINT fk_agents_creator
        FOREIGN KEY (created_by_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE SET NULL;
    `);

    // Agent -> Certifier
    await queryRunner.query(`
      ALTER TABLE agents
        ADD CONSTRAINT fk_agents_certifier
        FOREIGN KEY (certified_by_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE SET NULL;
    `);

    // ============================================
    // Agent History & Evaluations
    // ============================================

    // Training History -> Trainer
    await queryRunner.query(`
      ALTER TABLE registry_agent_training_history
        ADD CONSTRAINT fk_agent_training_trainer
        FOREIGN KEY (trained_by_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE SET NULL;
    `);

    // Evaluation -> Evaluator
    await queryRunner.query(`
      ALTER TABLE registry_agent_evaluations
        ADD CONSTRAINT fk_agent_evaluations_evaluator
        FOREIGN KEY (evaluator_logline_id)
        REFERENCES core_people(logline_id)
        ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints in reverse order
    await queryRunner.query(`ALTER TABLE registry_agent_evaluations DROP CONSTRAINT IF EXISTS fk_agent_evaluations_evaluator;`);
    await queryRunner.query(`ALTER TABLE registry_agent_training_history DROP CONSTRAINT IF EXISTS fk_agent_training_trainer;`);
    
    await queryRunner.query(`ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_agents_certifier;`);
    await queryRunner.query(`ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_agents_creator;`);
    await queryRunner.query(`ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_agents_owner;`);
    await queryRunner.query(`ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_agents_active_contract;`);
    
    await queryRunner.query(`ALTER TABLE registry_contracts DROP CONSTRAINT IF EXISTS fk_registry_contracts_witness;`);
    await queryRunner.query(`ALTER TABLE registry_contracts DROP CONSTRAINT IF EXISTS fk_registry_contracts_counterparty;`);
    await queryRunner.query(`ALTER TABLE registry_contracts DROP CONSTRAINT IF EXISTS fk_registry_contracts_author;`);
    
    await queryRunner.query(`ALTER TABLE registry_idea_votes DROP CONSTRAINT IF EXISTS fk_registry_idea_votes_voter;`);
    await queryRunner.query(`ALTER TABLE registry_ideas DROP CONSTRAINT IF EXISTS fk_registry_ideas_author;`);
  }
}

