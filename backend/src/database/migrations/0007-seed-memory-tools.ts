import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMemoryTools1763666210007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Memory store tool
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, created_at, updated_at)
      VALUES (
        'memory.store',
        'Store Memory',
        'Store a memory item for later retrieval. Memories can be short-term, long-term, or profile information.',
        '{"type":"object","properties":{"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"],"description":"Type of owner"},"owner_id":{"type":"string","description":"ID of the owner"},"type":{"type":"string","enum":["short_term","long_term","profile"],"description":"Type of memory"},"content":{"type":"string","description":"Content to store"},"metadata":{"type":"object","description":"Optional metadata"},"visibility":{"type":"string","enum":["private","org","public"],"default":"private"},"ttl":{"type":"string","format":"date-time","description":"Optional expiration date"}},"required":["owner_type","owner_id","type","content"]}'::jsonb,
        'builtin',
        '{"handler": "memory.store"}'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    // Memory retrieve tool
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, created_at, updated_at)
      VALUES (
        'memory.retrieve',
        'Retrieve Memory',
        'Retrieve memories by owner. Returns memories sorted by most recent first.',
        '{"type":"object","properties":{"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"]},"owner_id":{"type":"string"},"type":{"type":"string","enum":["short_term","long_term","profile"]},"limit":{"type":"number","default":50,"minimum":1,"maximum":100}},"required":["owner_type","owner_id"]}'::jsonb,
        'builtin',
        '{"handler": "memory.retrieve"}'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    // Memory search tool
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, created_at, updated_at)
      VALUES (
        'memory.search',
        'Search Memory',
        'Semantically search memories using natural language. Returns memories ranked by similarity to the query.',
        '{"type":"object","properties":{"query":{"type":"string","description":"Natural language query"},"owner_type":{"type":"string","enum":["user","tenant","app","agent","run"]},"owner_id":{"type":"string"},"type":{"type":"string","enum":["short_term","long_term","profile"]},"limit":{"type":"number","default":10,"minimum":1,"maximum":50},"threshold":{"type":"number","default":0.7,"minimum":0,"maximum":1}},"required":["query"]}'::jsonb,
        'builtin',
        '{"handler": "memory.search"}'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    // Memory delete tool
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, created_at, updated_at)
      VALUES (
        'memory.delete',
        'Delete Memory',
        'Delete a memory item by ID.',
        '{"type":"object","properties":{"memory_id":{"type":"string"}},"required":["memory_id"]}'::jsonb,
        'builtin',
        '{"handler": "memory.delete"}'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    console.log('✅ Memory tools seeded (memory.store, memory.retrieve, memory.search, memory.delete)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM tools WHERE id IN ('memory.store', 'memory.retrieve', 'memory.search', 'memory.delete');`);
    console.log('✅ Memory tools removed');
  }
}

