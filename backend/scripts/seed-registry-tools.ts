import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URL || `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function seed() {
  try {
    await dataSource.initialize();
    console.log('Database connected');

    const tools = [
      {
        id: 'registry_lookup_person',
        name: 'Registry: Lookup Person',
        description: 'Resolve a person identity by LogLine ID, CPF, or Email.',
        input_schema: {
          type: 'object',
          properties: {
            logline_id: { type: 'string', description: 'The unique LogLine ID' },
            cpf: { type: 'string', description: 'CPF number (will be hashed)' },
            email: { type: 'string', description: 'Email address' },
          },
          anyOf: [
            { required: ['logline_id'] },
            { required: ['cpf'] },
            { required: ['email'] },
          ],
        },
        handler_type: 'builtin',
        handler_config: { handler: 'registry_lookup_person' },
        risk_level: 'low',
        side_effects: ['database_read'],
      },
      {
        id: 'registry_get_contract',
        name: 'Registry: Get Contract',
        description: 'Get details and status of a contract.',
        input_schema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Contract UUID' },
          },
          required: ['id'],
        },
        handler_type: 'builtin',
        handler_config: { handler: 'registry_get_contract' },
        risk_level: 'low',
        side_effects: ['database_read'],
      },
      {
        id: 'registry_check_object',
        name: 'Registry: Check Object',
        description: 'Check status, location and custody of a registry object.',
        input_schema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Object UUID' },
          },
          required: ['id'],
        },
        handler_type: 'builtin',
        handler_config: { handler: 'registry_check_object' },
        risk_level: 'low',
        side_effects: ['database_read'],
      },
      {
        id: 'registry_search_ideas',
        name: 'Registry: Search Ideas',
        description: 'Search for ideas based on status.',
        input_schema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: [
                'rascunho',
                'aguardando_votos',
                'em_votacao',
                'aprovada',
                'rejeitada',
                'arquivada',
              ],
            },
            limit: { type: 'number', default: 5 },
          },
          required: [],
        },
        handler_type: 'builtin',
        handler_config: { handler: 'registry_search_ideas' },
        risk_level: 'low',
        side_effects: ['database_read'],
      },
    ];

    for (const tool of tools) {
      await dataSource.query(
        `
        INSERT INTO tools (id, name, description, input_schema, handler_type, handler_config, risk_level, side_effects, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          input_schema = EXCLUDED.input_schema,
          handler_type = EXCLUDED.handler_type,
          handler_config = EXCLUDED.handler_config,
          risk_level = EXCLUDED.risk_level,
          side_effects = EXCLUDED.side_effects,
          updated_at = NOW();
      `,
        [
          tool.id,
          tool.name,
          tool.description,
          tool.input_schema,
          tool.handler_type,
          tool.handler_config,
          tool.risk_level,
          tool.side_effects,
        ],
      );
      console.log(`Seeded tool: ${tool.id}`);
    }

    console.log('✅ Registry tools seeded successfully');
  } catch (error) {
    console.error('Error seeding registry tools:', error);
  } finally {
    await dataSource.destroy();
  }
}

seed();

