import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMemoryTables1763666210006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Memory items (user/tenant/app/agent/run-scoped memories)
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
      CREATE INDEX IF NOT EXISTS idx_memory_owner ON memory_items(owner_type, owner_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_items(owner_type, owner_id, type);
    `);

    // Vector index for semantic search (ivfflat with 100 lists for ~10k-100k vectors)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory_items 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);

    // Resources for RAG (chunked content, documents, etc.)
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_resources_memory ON resources(memory_item_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_resources_embedding ON resources 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);

    console.log('✅ Memory tables (memory_items, resources) created with pgvector indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_resources_embedding;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_resources_memory;`);
    await queryRunner.query(`DROP TABLE IF EXISTS resources;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_memory_embedding;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_memory_type;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_memory_owner;`);
    await queryRunner.query(`DROP TABLE IF EXISTS memory_items;`);
    console.log('✅ Memory tables dropped');
  }
}

