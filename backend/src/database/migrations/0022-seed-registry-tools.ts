import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRegistryTools1700000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. registry_lookup_person
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'registry_lookup_person',
        'Registry: Lookup Person',
        'Resolve a person identity by LogLine ID, CPF, or Email.',
        '{"type":"object","properties":{"logline_id":{"type":"string","description":"The unique LogLine ID"},"cpf":{"type":"string","description":"CPF number (will be hashed)"},"email":{"type":"string","description":"Email address"}},"anyOf":[{"required":["logline_id"]},{"required":["cpf"]},{"required":["email"]}]}'::jsonb,
        'builtin',
        '{"handler": "registry_lookup_person"}'::jsonb,
        'low',
        ARRAY['database_read'],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    // 2. registry_get_contract
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'registry_get_contract',
        'Registry: Get Contract',
        'Get details and status of a contract.',
        '{"type":"object","properties":{"id":{"type":"string","description":"Contract UUID"}},"required":["id"]}'::jsonb,
        'builtin',
        '{"handler": "registry_get_contract"}'::jsonb,
        'low',
        ARRAY['database_read'],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    // 3. registry_check_object
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'registry_check_object',
        'Registry: Check Object',
        'Check status, location and custody of a registry object.',
        '{"type":"object","properties":{"id":{"type":"string","description":"Object UUID"}},"required":["id"]}'::jsonb,
        'builtin',
        '{"handler": "registry_check_object"}'::jsonb,
        'low',
        ARRAY['database_read'],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    // 4. registry_search_ideas
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'registry_search_ideas',
        'Registry: Search Ideas',
        'Search for ideas based on status.',
        '{"type":"object","properties":{"status":{"type":"string","enum":["rascunho","aguardando_votos","em_votacao","aprovada","rejeitada","arquivada"]},"limit":{"type":"number","default":5}},"required":[]}'::jsonb,
        'builtin',
        '{"handler": "registry_search_ideas"}'::jsonb,
        'low',
        ARRAY['database_read'],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        risk_level = EXCLUDED.risk_level,
        side_effects = EXCLUDED.side_effects,
        handler_type = EXCLUDED.handler_type,
        handler_config = EXCLUDED.handler_config,
        updated_at = NOW();
    `);

    console.log('✅ Registry tools seeded (registry_lookup_person, registry_get_contract, registry_check_object, registry_search_ideas)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM tools WHERE id IN ('registry_lookup_person', 'registry_get_contract', 'registry_check_object', 'registry_search_ideas');`);
    console.log('✅ Registry tools removed');
  }
}

