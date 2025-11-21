import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';

export interface BudgetMetrics {
  costCents: number;
  llmCalls: number;
  startTime: number;
}

@Injectable()
export class BudgetTrackerService {
  private readonly logger = new Logger(BudgetTrackerService.name);
  private readonly runMetrics = new Map<string, BudgetMetrics>();

  constructor(
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  /**
   * Initialize budget tracking for a run
   */
  initializeRun(runId: string): void {
    this.runMetrics.set(runId, {
      costCents: 0,
      llmCalls: 0,
      startTime: Date.now(),
    });
  }

  /**
   * Add cost to run (in cents)
   */
  addCost(runId: string, costCents: number): void {
    const metrics = this.runMetrics.get(runId);
    if (metrics) {
      metrics.costCents += costCents;
    }
  }

  /**
   * Increment LLM call count
   */
  incrementLlmCalls(runId: string): void {
    const metrics = this.runMetrics.get(runId);
    if (metrics) {
      metrics.llmCalls += 1;
    }
  }

  /**
   * Check if run has exceeded any budget limits
   */
  async checkBudget(runId: string): Promise<{
    exceeded: boolean;
    reason?: 'cost' | 'llm_calls' | 'latency';
  }> {
    const run = await this.runRepository.findOne({ where: { id: runId } });
    if (!run) {
      return { exceeded: false };
    }

    const metrics = this.runMetrics.get(runId);
    if (!metrics) {
      return { exceeded: false };
    }

    // Check cost limit
    if (run.cost_limit_cents && metrics.costCents > run.cost_limit_cents) {
      await this.logBudgetExceeded(runId, 'cost', {
        limit: run.cost_limit_cents,
        actual: metrics.costCents,
      });
      return { exceeded: true, reason: 'cost' };
    }

    // Check LLM calls limit
    if (run.llm_calls_limit && metrics.llmCalls > run.llm_calls_limit) {
      await this.logBudgetExceeded(runId, 'llm_calls', {
        limit: run.llm_calls_limit,
        actual: metrics.llmCalls,
      });
      return { exceeded: true, reason: 'llm_calls' };
    }

    // Check latency SLO
    if (run.latency_slo_ms) {
      const elapsed = Date.now() - metrics.startTime;
      if (elapsed > run.latency_slo_ms) {
        await this.logBudgetExceeded(runId, 'latency', {
          limit: run.latency_slo_ms,
          actual: elapsed,
        });
        return { exceeded: true, reason: 'latency' };
      }
    }

    return { exceeded: false };
  }

  /**
   * Get current metrics for a run
   */
  getMetrics(runId: string): BudgetMetrics | undefined {
    return this.runMetrics.get(runId);
  }

  /**
   * Clean up metrics when run completes
   */
  cleanup(runId: string): void {
    this.runMetrics.delete(runId);
  }

  private async logBudgetExceeded(
    runId: string,
    reason: 'cost' | 'llm_calls' | 'latency',
    details: { limit: number; actual: number },
  ): Promise<void> {
    this.logger.warn(`Budget exceeded for run ${runId}: ${reason}`, {
      run_id: runId,
      reason,
      limit: details.limit,
      actual: details.actual,
    });

    await this.eventRepository.save({
      run_id: runId,
      kind: EventKind.POLICY_EVAL,
      payload: {
        type: 'budget_exceeded',
        reason: `budget_exceeded: ${reason}`,
        limit: details.limit,
        actual: details.actual,
      },
    });
  }
}

