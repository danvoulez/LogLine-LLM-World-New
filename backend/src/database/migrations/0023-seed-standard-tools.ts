import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedStandardTools1700000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. http_request
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'http_request',
        'HTTP Request',
        'Make generic HTTP requests (GET, POST, PUT, DELETE, PATCH).',
        '{"type":"object","properties":{"method":{"type":"string","enum":["GET","POST","PUT","DELETE","PATCH"]},"url":{"type":"string","format":"uri"},"headers":{"type":"object","additionalProperties":{"type":"string"}},"body":{"type":"object","description":"JSON body for the request"}},"required":["method","url"]}'::jsonb,
        'builtin',
        '{"handler": "http_request"}'::jsonb,
        'high',
        ARRAY['external_api_call'],
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

    // 2. github_api
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'github_api',
        'GitHub API',
        'Interact with GitHub API to manage repositories, issues, and PRs.',
        '{"type":"object","properties":{"operation":{"type":"string","enum":["get_issue","create_issue","get_pr","list_repos"]},"owner":{"type":"string"},"repo":{"type":"string"},"issue_number":{"type":"number"},"title":{"type":"string"},"body":{"type":"string"}},"required":["operation"]}'::jsonb,
        'builtin',
        '{"handler": "github_api"}'::jsonb,
        'medium',
        ARRAY['external_api_call'],
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

    // 3. calculator
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'calculator',
        'Calculator',
        'Evaluate mathematical expressions safely.',
        '{"type":"object","properties":{"expression":{"type":"string","description":"Math expression to evaluate"}},"required":["expression"]}'::jsonb,
        'builtin',
        '{"handler": "calculator"}'::jsonb,
        'low',
        ARRAY[]::text[],
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

    console.log('✅ Standard library tools seeded (http_request, github_api, calculator)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM tools WHERE id IN ('http_request', 'github_api', 'calculator');`);
    console.log('✅ Standard library tools removed');
  }
}

