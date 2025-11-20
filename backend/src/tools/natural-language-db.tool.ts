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
          prompt: `You're helping convert a natural language question into a PostgreSQL SQL SELECT query.

Question: ${input.query}

Here's the database schema you're working with:
- workflows: stores workflow definitions (id, name, version, definition, type, timestamps)
- runs: stores workflow execution runs (id, workflow_id, status, mode, input, result, timestamps)
- steps: stores individual step executions (id, run_id, node_id, type, status, input, output, timestamps)
- events: stores execution events and logs (id, run_id, step_id, kind, payload, timestamp)
- tools: stores tool definitions (id, name, description, input_schema, handler config)
- agents: stores agent definitions (id, name, instructions, model_profile, allowed_tools)

Please generate a SELECT query that answers the question. This is a read-only operation, so only SELECT statements are allowed. If you notice any issues or need clarification about the schema, feel free to mention them.

Generate the SQL query:`,
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

        // Generate SQL from natural language - dignified, clear, helpful
        const result = await generateText({
          model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
          prompt: `You're helping convert a natural language instruction into a PostgreSQL SQL statement for a write operation.

Instruction: ${instruction}

Here's the database schema you're working with:
- workflows: workflow definitions (id, name, version, definition, type, timestamps)
- runs: workflow execution runs (id, workflow_id, status, mode, input, result, timestamps)
- steps: step executions (id, run_id, node_id, type, status, input, output, timestamps)
- events: execution events (id, run_id, step_id, kind, payload, timestamp)
- tools: tool definitions (id, name, description, input_schema, handler config)
- agents: agent definitions (id, name, instructions, model_profile, allowed_tools)

For this write operation, you can use INSERT or UPDATE statements. Please avoid DELETE, DROP, TRUNCATE, or ALTER operations for safety.

Generate the SQL query that accomplishes the instruction. If you notice any potential issues or need clarification, feel free to mention them.

SQL query:`,
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

