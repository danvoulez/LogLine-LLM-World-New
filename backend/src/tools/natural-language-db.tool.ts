import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ToolContext } from './tool-runtime.service';
import { RunsService } from '../runs/runs.service';
import { LlmRouterService } from '../llm/llm-router.service';

@Injectable()
export class NaturalLanguageDbTool {
  constructor(
    private dataSource: DataSource,
    private runsService: RunsService,
    private llmRouter: LlmRouterService,
  ) {}

  /**
   * Enhanced SQL validation for write operations
   * 
   * Validates SQL to prevent:
   * - Dangerous operations (DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE)
   * - Transaction control (BEGIN, COMMIT, ROLLBACK)
   * - SQL injection attempts
   * - Operations hidden in CTEs, comments, or subqueries
   * 
   * NOTE: This is a heuristic-based validation. For production use with untrusted input,
   * consider using a proper SQL parser or whitelisting specific operations.
   * 
   * @param sql - SQL query to validate
   * @returns Error message if invalid, null if valid
   */
  private validateWriteSQL(sql: string): string | null {
    // Remove SQL comments (-- and /* */)
    let cleaned = sql;
    
    // Remove single-line comments (-- ...)
    cleaned = cleaned.replace(/--.*$/gm, '');
    
    // Remove multi-line comments (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    const upper = cleaned.toUpperCase();
    
    // Blocked operations (check anywhere in query, not just prefix)
    const BLOCKED_OPERATIONS = [
      'DELETE',
      'DROP',
      'TRUNCATE',
      'ALTER',
      'CREATE',
      'GRANT',
      'REVOKE',
      'EXEC',
      'EXECUTE',
      'CALL',
    ];
    
    // Check for blocked operations anywhere in the query
    for (const op of BLOCKED_OPERATIONS) {
      // Use word boundary regex to avoid false positives (e.g., "INSERT" matching "INSERTED")
      const regex = new RegExp(`\\b${op}\\b`, 'i');
      if (regex.test(cleaned)) {
        return `Operation ${op} is not allowed`;
      }
    }
    
    // Block transaction control statements
    const TRANSACTION_KEYWORDS = ['BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'];
    for (const keyword of TRANSACTION_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(cleaned)) {
        return `Transaction control (${keyword}) is not allowed. Transactions are handled automatically.`;
      }
    }
    
    // Block multiple statements (semicolon-separated)
    const statements = cleaned.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      return 'Multiple statements are not allowed. Only single INSERT or UPDATE statements are permitted.';
    }
    
    // Must start with INSERT or UPDATE
    const ALLOWED_OPERATIONS = ['INSERT', 'UPDATE'];
    const startsWithAllowed = ALLOWED_OPERATIONS.some((op) => {
      const regex = new RegExp(`^\\s*${op}\\b`, 'i');
      return regex.test(cleaned);
    });
    
    if (!startsWithAllowed) {
      return 'Only INSERT and UPDATE operations are allowed';
    }
    
    // Additional safety: check for suspicious patterns
    // Block semicolons that might be used for injection
    if (sql.includes(';') && sql.split(';').length > 2) {
      return 'Multiple statements detected. Only single statements are allowed.';
    }
    
    // Block UNION (common SQL injection pattern)
    if (/\bUNION\b/i.test(cleaned)) {
      return 'UNION operations are not allowed in write queries';
    }
    
    return null; // Valid SQL
  }

  async createReadTool() {
    return {
      id: 'natural_language_db_read',
      description: 'Query the database using natural language. READ-ONLY operations. Converts your question to SQL SELECT queries.',
      execute: async (input: { query: string }, context: ToolContext) => {
        // Policy check is handled by ToolRuntimeService before calling this handler
        // No need to check here - if we reach this point, policy has already been evaluated

        // Use AI to convert natural language to SQL via LlmRouterService (for observability and budget tracking)
        const result = await this.llmRouter.generateText(
          `You're helping convert a natural language question into a PostgreSQL SQL SELECT query.

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
          {
            provider: 'openai',
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0,
          },
          undefined,
          {
            agentId: 'natural_language_db_read',
            runId: context.runId,
            stepId: context.stepId,
          },
        );

        let sql = result.text.trim();

        // Validate it's a SELECT query
        if (!sql.toUpperCase().startsWith('SELECT')) {
          throw new Error('Security: Only SELECT queries are allowed for read operations');
        }

        // Add default LIMIT 200 if not present (safety measure)
        const sqlUpper = sql.toUpperCase();
        if (!sqlUpper.includes('LIMIT')) {
          // Check if query ends with semicolon
          if (sql.trim().endsWith(';')) {
            sql = sql.trim().slice(0, -1) + ' LIMIT 200;';
          } else {
            sql = sql.trim() + ' LIMIT 200';
          }
        }

        // Classify query type for observability
        let queryClassification: 'simple_lookup' | 'reporting' | 'unknown' = 'unknown';
        if (sqlUpper.includes('COUNT') || sqlUpper.includes('SUM') || sqlUpper.includes('AVG') || sqlUpper.includes('GROUP BY')) {
          queryClassification = 'reporting';
        } else if (sqlUpper.includes('WHERE') && !sqlUpper.includes('JOIN')) {
          queryClassification = 'simple_lookup';
        }

        // Execute SQL in READ ONLY transaction for security
        // This prevents any data modification even if SQL contains CTEs or other tricks
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        
        try {
          // Start READ ONLY transaction
          await queryRunner.query('BEGIN TRANSACTION READ ONLY');
          
          // Execute query
          const results = await queryRunner.query(sql);
          
          // Always rollback (READ ONLY transactions don't commit changes anyway, but this is extra safety)
          await queryRunner.rollbackTransaction();
          
          return {
            operation: 'read',
            sql,
            results,
            rowCount: results.length,
            query_classification: queryClassification,
          };
        } catch (error) {
          // Rollback on error
          await queryRunner.rollbackTransaction();
          throw error;
        } finally {
          await queryRunner.release();
        }
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
          require_human_confirmation?: boolean;
        },
        context: ToolContext,
      ) => {
        // Policy check is handled by ToolRuntimeService before calling this handler
        // No need to check here - if we reach this point, policy has already been evaluated

        // Validate app scope (write operations should be scoped to specific apps)
        if (!context.appId) {
          throw new Error(
            'Security: Database write operations require explicit app scope. This tool should only be used within an app context.',
          );
        }

        const { instruction, dryRun = true, confirm = false, require_human_confirmation = true } = input;

        // Generate SQL from natural language via LlmRouterService (for observability and budget tracking)
        const result = await this.llmRouter.generateText(
          `You're helping convert a natural language instruction into a PostgreSQL SQL statement for a write operation.

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
          {
            provider: 'openai',
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0,
          },
          undefined,
          {
            agentId: 'natural_language_db_write',
            runId: context.runId,
            stepId: context.stepId,
          },
        );

        const sql = result.text.trim();

        // Validate SQL (enhanced security check)
        const validationError = this.validateWriteSQL(sql);
        if (validationError) {
          throw new Error(`Security: ${validationError}`);
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
            require_human_confirmation: require_human_confirmation,
            proposedAction: instruction,
            proposedSQL: sql,
            message:
              'Write operation requires explicit confirmation. Set confirm=true to proceed.',
            app_id: context.appId,
          };
        }

        // If require_human_confirmation is true, still require explicit human approval
        if (require_human_confirmation && !confirm) {
          return {
            operation: 'write',
            requiresConfirmation: true,
            require_human_confirmation: true,
            proposedAction: instruction,
            proposedSQL: sql,
            message:
              'This write operation requires human confirmation. Set require_human_confirmation=false or confirm=true to proceed.',
            app_id: context.appId,
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

