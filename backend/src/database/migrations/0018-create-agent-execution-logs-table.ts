import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 0018: Create Agent Execution Logs Table
 * 
 * This migration creates the agent execution logs table for detailed
 * observability and debugging of agent executions.
 * 
 * IMPORTANT: This migration must run AFTER 0014 (create-registry-agents-tables)
 */
export class CreateAgentExecutionLogsTable1700000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registry_agent_execution_logs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id        VARCHAR(255) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        
        execution_id    VARCHAR(255) NOT NULL,
        started_at      TIMESTAMPTZ NOT NULL,
        finished_at      TIMESTAMPTZ,
        status          VARCHAR(50) NOT NULL,
        
        -- Métricas da execução
        total_steps     INTEGER,
        tools_used      JSONB,
        cost_cents      INTEGER,
        
        -- Input/Output (opcional, para auditoria)
        input_summary   TEXT,
        output_summary  TEXT,
        
        -- Erros (se houver)
        error_message   TEXT,
        error_stack     TEXT,
        
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent ON registry_agent_execution_logs(agent_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_started ON registry_agent_execution_logs(started_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_status ON registry_agent_execution_logs(status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_status ON registry_agent_execution_logs(agent_id, status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS registry_agent_execution_logs;`);
  }
}

