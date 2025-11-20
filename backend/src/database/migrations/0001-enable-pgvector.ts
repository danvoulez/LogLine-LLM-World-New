import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgVector1763666210000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension enabled');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: We don't drop the extension as it might be used by other tables
    // If you really need to drop it:
    // await queryRunner.query('DROP EXTENSION IF EXISTS vector;');
  }
}

