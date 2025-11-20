import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ToolContext } from './tool-runtime.service';
import { RunsService } from '../runs/runs.service';

@Injectable()
export class NaturalLanguageDbTool {
  constructor(
    private dataSource: DataSource,
    private runsService: RunsService,
  ) {}

  async createReadTool() {
    return {
      id: 'natural_language_db_read',
      description: 'Query the database using natural language. READ-ONLY operations. Converts your question to SQL SELECT queries.',
      execute: async (input: { query: string }, context: ToolContext) => {
        // TODO: Policy check (Phase 4)
        // const allowed = await this.policyEngine.checkToolCall(
        //   'natural_language_db_read',
        //   context.runId,
        //   context.appId,
        // );
        // if (!allowed) {
        //   throw new Error('Policy denied: Database read access not allowed');
        // }

        // Use AI to convert natural language to SQL
        const result = await generateText({
          model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
          prompt: `Convert this natural language query to PostgreSQL SQL SELECT statement:

Query: ${input.query}

Database schema:
- workflows (id uuid, name text, version text, definition jsonb, type text, created_at timestamp, updated_at timestamp)
- runs (id uuid, workflow_id uuid, workflow_version text, app_id uuid, app_action_id uuid, user_id uuid, tenant_id uuid, status text, mode text, input jsonb, result jsonb, created_at timestamp, updated_at timestamp)
- steps (id uuid, run_id uuid, node_id text, type text, status text, input jsonb, output jsonb, started_at timestamp, finished_at timestamp)
- events (id uuid, run_id uuid, step_id uuid, kind text, payload jsonb, ts timestamp)
- tools (id varchar, name varchar, description text, input_schema jsonb, handler_type varchar, handler_config jsonb, created_at timestamp, updated_at timestamp)
- agents (id varchar, name varchar, instructions text, model_profile jsonb, allowed_tools jsonb, created_at timestamp, updated_at timestamp)

IMPORTANT: 
- Only generate SELECT queries (READ operations)
- Never generate INSERT, UPDATE, DELETE, DROP, TRUNCATE, or ALTER
- Return ONLY the SQL query, no explanation`,
        });

        const sql = result.text.trim();

        // Validate it's a SELECT query
        if (!sql.toUpperCase().startsWith('SELECT')) {
          throw new Error('Security: Only SELECT queries are allowed for read operations');
        }

        // Execute SQL
        const results = await this.dataSource.query(sql);

        return {
          operation: 'read',
          sql,
          results,
          rowCount: results.length,
        };
      },
    };
  }

  async createWriteTool() {
    return {
      id: 'natural_language_db_write',
      description: 'Modify the database using natural language. Supports INSERT, UPDATE operations. Requires explicit confirmation. By default, runs in dry-run mode to preview SQL before execution.',
      execute: async (
        input: {
          instruction: string;
          dryRun?: boolean;
          confirm?: boolean;
        },
        context: ToolContext,
      ) => {
        // TODO: Policy check (Phase 4)
        // const allowed = await this.policyEngine.checkToolCall(
        //   'natural_language_db_write',
        //   context.runId,
        //   context.appId,
        // );
        // if (!allowed) {
        //   throw new Error('Policy denied: Database write access not allowed');
        // }

        const { instruction, dryRun = true, confirm = false } = input;

        // Generate SQL from natural language
        const result = await generateText({
          model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
          prompt: `Convert this natural language instruction to PostgreSQL SQL:

Instruction: ${instruction}

Database schema:
- workflows (id uuid, name text, version text, definition jsonb, type text, created_at timestamp, updated_at timestamp)
- runs (id uuid, workflow_id uuid, workflow_version text, app_id uuid, app_action_id uuid, user_id uuid, tenant_id uuid, status text, mode text, input jsonb, result jsonb, created_at timestamp, updated_at timestamp)
- steps (id uuid, run_id uuid, node_id text, type text, status text, input jsonb, output jsonb, started_at timestamp, finished_at timestamp)
- events (id uuid, run_id uuid, step_id uuid, kind text, payload jsonb, ts timestamp)
- tools (id varchar, name varchar, description text, input_schema jsonb, handler_type varchar, handler_config jsonb, created_at timestamp, updated_at timestamp)
- agents (id varchar, name varchar, instructions text, model_profile jsonb, allowed_tools jsonb, created_at timestamp, updated_at timestamp)

IMPORTANT: 
- Only generate INSERT or UPDATE statements
- Never generate DELETE, DROP, TRUNCATE, or ALTER
- Return ONLY the SQL query, no explanation`,
        });

        const sql = result.text.trim();

        // Validate SQL (security check)
        const upper = sql.toUpperCase();
        const BLOCKED_OPERATIONS = [
          'DELETE',
          'DROP',
          'TRUNCATE',
          'ALTER',
          'CREATE',
          'GRANT',
          'REVOKE',
        ];
        const ALLOWED_OPERATIONS = ['INSERT', 'UPDATE'];

        if (BLOCKED_OPERATIONS.some((op) => upper.startsWith(op))) {
          throw new Error(
            `Security: Operation ${BLOCKED_OPERATIONS.find((op) => upper.startsWith(op))} is not allowed`,
          );
        }

        if (!ALLOWED_OPERATIONS.some((op) => upper.startsWith(op))) {
          throw new Error(
            'Security: Only INSERT and UPDATE operations are allowed',
          );
        }

        // Dry run mode: return SQL without executing
        if (dryRun && !confirm) {
          return {
            dryRun: true,
            operation: 'preview',
            proposedSQL: sql,
            message:
              'This is a dry run. Review the SQL above. Set dryRun=false and confirm=true to execute.',
            requiresConfirmation: true,
          };
        }

        // Require explicit confirmation for write operations
        if (!confirm) {
          return {
            operation: 'write',
            requiresConfirmation: true,
            proposedAction: instruction,
            proposedSQL: sql,
            message:
              'Write operation requires explicit confirmation. Set confirm=true to proceed.',
          };
        }

        // Check if run is in draft mode (safer for writes)
        try {
          const run = await this.runsService.findOne(context.runId);
          if (run.mode === 'auto') {
            // In auto mode, we still allow writes but log them
            // TODO: Add extra approval step in Phase 4
          }
        } catch (error) {
          // If we can't find the run, continue (might be a test scenario)
        }

        // Execute SQL in a transaction
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const results = await queryRunner.query(sql);
          await queryRunner.commitTransaction();

          return {
            operation: 'write',
            sql,
            results,
            message: 'Write operation completed successfully',
          };
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw new Error(
            `Database write failed: ${error.message}. Transaction rolled back.`,
          );
        } finally {
          await queryRunner.release();
        }
      },
    };
  }
}

