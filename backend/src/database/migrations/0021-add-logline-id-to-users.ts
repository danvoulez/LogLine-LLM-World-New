import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0021: Add LogLine ID to Users
 * 
 * Bridges the gap between Auth (Users) and Registry (Core People).
 * Adds logline_id to users table and creates a foreign key.
 */
export class AddLoglineIdToUsers1700000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN logline_id VARCHAR(50);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_logline_id ON users(logline_id);
    `);

    // We add the FK constraint but allow NULL initially for existing users
    // A migration script or manual process would be needed to backfill existing users
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_users_logline_id
      FOREIGN KEY (logline_id)
      REFERENCES core_people(logline_id)
      ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT fk_users_logline_id;`);
    await queryRunner.query(`DROP INDEX idx_users_logline_id;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN logline_id;`);
  }
}

