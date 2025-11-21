import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0004: Seed built-in tools
 * 
 * Creates default tools that are required for the system to function:
 * - natural_language_db_read: Read-only database queries
 * - natural_language_db_write: Write operations (INSERT/UPDATE) with safety checks
 * - ticketing.list_open: Placeholder ticketing tool
 * 
 * IMPORTANT: This migration must run AFTER 0003 (create-core-tables)
 */
export class SeedBuiltinTools1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Natural Language DB Read Tool
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'natural_language_db_read',
        'Natural Language DB Read',
        'Query the database using natural language. READ-ONLY operations. Converts your question to SQL SELECT queries.',
        '{
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Natural language question about the database"
            }
          },
          "required": ["query"]
        }'::jsonb,
        'builtin',
        '{"handler": "natural_language_db_read"}'::jsonb,
        'medium',
        ARRAY['database_read']::text[],
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

    // Natural Language DB Write Tool
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'natural_language_db_write',
        'Natural Language DB Write',
        'Write to the database using natural language. Supports INSERT and UPDATE operations. Requires explicit confirmation (dryRun=false, confirm=true).',
        '{
          "type": "object",
          "properties": {
            "instruction": {
              "type": "string",
              "description": "Natural language instruction for the write operation"
            },
            "dryRun": {
              "type": "boolean",
              "description": "If true, return SQL without executing (default: true)",
              "default": true
            },
            "confirm": {
              "type": "boolean",
              "description": "If true, execute the SQL (requires dryRun=false)",
              "default": false
            }
          },
          "required": ["instruction"]
        }'::jsonb,
        'builtin',
        '{"handler": "natural_language_db_write"}'::jsonb,
        'high',
        ARRAY['database_write', 'data_modification']::text[],
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

    // Ticketing List Open Tool (Placeholder)
    await queryRunner.query(`
      INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
      VALUES (
        'ticketing.list_open',
        'List Open Tickets',
        'List all open tickets from the ticketing system. This is a placeholder tool for demonstration purposes.',
        '{
          "type": "object",
          "properties": {
            "filters": {
              "type": "object",
              "description": "Optional filters for ticket listing",
              "properties": {
                "priority": {
                  "type": "string",
                  "enum": ["low", "medium", "high", "urgent"]
                },
                "assignee": {
                  "type": "string"
                }
              }
            }
          }
        }'::jsonb,
        'builtin',
        '{"handler": "ticketing.list_open", "placeholder": true}'::jsonb,
        'low',
        ARRAY[]::text[],
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

    console.log('✅ Built-in tools seeded successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tools 
      WHERE id IN ('natural_language_db_read', 'natural_language_db_write', 'ticketing.list_open');
    `);
    console.log('✅ Built-in tools removed');
  }
}

