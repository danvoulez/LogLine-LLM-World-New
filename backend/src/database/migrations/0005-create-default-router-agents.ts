import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0005: Create default router agents
 * 
 * Creates default agents required for router nodes and conditional edge evaluation:
 * - agent.router: For routing decisions in router nodes
 * - agent.condition_evaluator: For evaluating conditional edges
 * 
 * IMPORTANT: This migration must run AFTER 0003 (create-core-tables) and 0004 (seed-builtin-tools)
 */
export class CreateDefaultRouterAgents1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create default router agent
    await queryRunner.query(`
      INSERT INTO agents (id, name, instructions, model_profile, allowed_tools, created_at, updated_at)
      VALUES (
        'agent.router',
        'Router Agent',
        'You are a routing agent. Your job is to analyze the output from previous workflow steps and determine which route to take based on the available options. Respond with ONLY the route ID (e.g., "high_priority" or "normal"). Do not include any explanation or additional text.',
        '{"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 50}'::jsonb,
        ARRAY[]::varchar[],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create default condition evaluator agent
    await queryRunner.query(`
      INSERT INTO agents (id, name, instructions, model_profile, allowed_tools, created_at, updated_at)
      VALUES (
        'agent.condition_evaluator',
        'Condition Evaluator Agent',
        'You are a condition evaluator. Your job is to analyze step output and determine which condition is true. Respond with ONLY the number (1, 2, 3, etc.) of the condition that is true. If none are true, respond with "0". Do not include any explanation.',
        '{"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 10}'::jsonb,
        ARRAY[]::varchar[],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM agents WHERE id IN ('agent.router', 'agent.condition_evaluator');`);
  }
}

