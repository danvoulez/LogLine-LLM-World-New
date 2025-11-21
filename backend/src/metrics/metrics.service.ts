import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Step, StepStatus } from '../runs/entities/step.entity';
import { EnhancedMetricsService, EnhancedMetricsSnapshot } from './enhanced-metrics.service';

export interface MetricsSnapshot {
  timestamp: Date;
  runs: {
    total: number;
    by_status: Record<RunStatus, number>;
    completed_today: number;
    failed_today: number;
  };
  llm: {
    calls_total: number;
    calls_today: number;
    tokens_total: number;
    tokens_today: number;
    cost_cents_total: number;
    cost_cents_today: number;
    by_provider: Record<string, number>;
  };
  tools: {
    calls_total: number;
    calls_today: number;
    by_tool: Record<string, number>;
  };
  policies: {
    evaluations_total: number;
    evaluations_today: number;
    denials_total: number;
    denials_today: number;
    approvals_total: number;
    approvals_today: number;
  };
  memory: {
    items_total: number;
    operations_today: number;
  };
  errors: {
    total: number;
    today: number;
    by_type: Record<string, number>;
  };
  performance: {
    avg_run_duration_ms: number;
    avg_step_duration_ms: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    private enhancedMetrics: EnhancedMetricsService,
  ) {}

  /**
   * Get enhanced metrics snapshot (recommended)
   */
  async getEnhancedMetricsSnapshot(tenantId?: string): Promise<EnhancedMetricsSnapshot> {
    return this.enhancedMetrics.getEnhancedMetricsSnapshot(tenantId);
  }

  /**
   * Get current metrics snapshot (legacy - for backward compatibility)
   */
  async getMetricsSnapshot(tenantId?: string): Promise<MetricsSnapshot> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereClause = tenantId ? { tenant_id: tenantId } : {};

    // Runs metrics
    const runsTotal = await this.runRepository.count({ where: whereClause });
    const runsByStatus = await this.runRepository
      .createQueryBuilder('run')
      .select('run.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(tenantId ? 'run.tenant_id = :tenantId' : '1=1', { tenantId })
      .groupBy('run.status')
      .getRawMany();

    const runsByStatusMap: Record<string, number> = {};
    runsByStatus.forEach((row) => {
      runsByStatusMap[row.status] = parseInt(row.count, 10);
    });

    const runsCompletedToday = await this.runRepository.count({
      where: {
        ...whereClause,
        status: RunStatus.COMPLETED,
        // created_at >= today (would need to add this condition)
      },
    });

    const runsFailedToday = await this.runRepository.count({
      where: {
        ...whereClause,
        status: RunStatus.FAILED,
      },
    });

    // LLM metrics from events
    const llmEvents = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.LLM_CALL })
      .andWhere(tenantId ? 'event.payload->>\'tenant_id\' = :tenantId' : '1=1', { tenantId })
      .getMany();

    const llmCallsTotal = llmEvents.length;
    const llmCallsToday = llmEvents.filter(
      (e) => e.ts && new Date(e.ts) >= today,
    ).length;

    let tokensTotal = 0;
    let tokensToday = 0;
    let costCentsTotal = 0;
    let costCentsToday = 0;
    const byProvider: Record<string, number> = {};

    llmEvents.forEach((event) => {
      const payload = event.payload as any;
      const usage = payload.usage || {};
      const tokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
      tokensTotal += tokens;

      const cost = payload.estimated_cost_cents || 0;
      costCentsTotal += cost;

      const provider = payload.provider || 'unknown';
      byProvider[provider] = (byProvider[provider] || 0) + 1;

      if (event.ts && new Date(event.ts) >= today) {
        tokensToday += tokens;
        costCentsToday += cost;
      }
    });

    // Tool calls metrics
    const toolEvents = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.TOOL_CALL })
      .andWhere(tenantId ? 'event.payload->>\'tenant_id\' = :tenantId' : '1=1', { tenantId })
      .getMany();

    const toolCallsTotal = toolEvents.length;
    const toolCallsToday = toolEvents.filter(
      (e) => e.ts && new Date(e.ts) >= today,
    ).length;

    const byTool: Record<string, number> = {};
    toolEvents.forEach((event) => {
      const payload = event.payload as any;
      const toolId = payload.tool_id || 'unknown';
      byTool[toolId] = (byTool[toolId] || 0) + 1;
    });

    // Policy evaluations
    const policyEvents = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.POLICY_EVAL })
      .andWhere(tenantId ? 'event.payload->>\'tenant_id\' = :tenantId' : '1=1', { tenantId })
      .getMany();

    const policyEvalsTotal = policyEvents.length;
    const policyEvalsToday = policyEvents.filter(
      (e) => e.ts && new Date(e.ts) >= today,
    ).length;

    let denialsTotal = 0;
    let denialsToday = 0;
    let approvalsTotal = 0;
    let approvalsToday = 0;

    policyEvents.forEach((event) => {
      const payload = event.payload as any;
      const effect = payload.effect || 'unknown';
      if (effect === 'deny') {
        denialsTotal++;
        if (event.ts && new Date(event.ts) >= today) {
          denialsToday++;
        }
      } else if (effect === 'allow') {
        approvalsTotal++;
        if (event.ts && new Date(event.ts) >= today) {
          approvalsToday++;
        }
      }
    });

    // Error events
    const errorEvents = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.ERROR })
      .andWhere(tenantId ? 'event.payload->>\'tenant_id\' = :tenantId' : '1=1', { tenantId })
      .getMany();

    const errorsTotal = errorEvents.length;
    const errorsToday = errorEvents.filter(
      (e) => e.ts && new Date(e.ts) >= today,
    ).length;

    const errorsByType: Record<string, number> = {};
    errorEvents.forEach((event) => {
      const payload = event.payload as any;
      const errorType = payload.error_type || 'unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    // Performance metrics (average durations)
    const completedRuns = await this.runRepository.find({
      where: {
        ...whereClause,
        status: RunStatus.COMPLETED,
      },
      take: 100, // Sample last 100 completed runs
      order: { created_at: 'DESC' },
    });

    let totalRunDuration = 0;
    let runCount = 0;

    for (const run of completedRuns) {
      if (run.created_at && run.updated_at) {
        const duration = new Date(run.updated_at).getTime() - new Date(run.created_at).getTime();
        totalRunDuration += duration;
        runCount++;
      }
    }

    const avgRunDurationMs = runCount > 0 ? totalRunDuration / runCount : 0;

    // Average step duration (sample)
    const completedSteps = await this.stepRepository.find({
      where: {
        status: StepStatus.COMPLETED,
      },
      take: 100,
      order: { started_at: 'DESC' },
    });

    let totalStepDuration = 0;
    let stepCount = 0;

    for (const step of completedSteps) {
      if (step.started_at && step.finished_at) {
        const duration =
          new Date(step.finished_at).getTime() - new Date(step.started_at).getTime();
        totalStepDuration += duration;
        stepCount++;
      }
    }

    const avgStepDurationMs = stepCount > 0 ? totalStepDuration / stepCount : 0;

    return {
      timestamp: new Date(),
      runs: {
        total: runsTotal,
        by_status: runsByStatusMap as Record<RunStatus, number>,
        completed_today: runsCompletedToday,
        failed_today: runsFailedToday,
      },
      llm: {
        calls_total: llmCallsTotal,
        calls_today: llmCallsToday,
        tokens_total: tokensTotal,
        tokens_today: tokensToday,
        cost_cents_total: costCentsTotal,
        cost_cents_today: costCentsToday,
        by_provider: byProvider,
      },
      tools: {
        calls_total: toolCallsTotal,
        calls_today: toolCallsToday,
        by_tool: byTool,
      },
      policies: {
        evaluations_total: policyEvalsTotal,
        evaluations_today: policyEvalsToday,
        denials_total: denialsTotal,
        denials_today: denialsToday,
        approvals_total: approvalsTotal,
        approvals_today: approvalsToday,
      },
      memory: {
        items_total: 0, // Would need to query memory_items table
        operations_today: 0, // Would need to track memory operations
      },
      errors: {
        total: errorsTotal,
        today: errorsToday,
        by_type: errorsByType,
      },
      performance: {
        avg_run_duration_ms: avgRunDurationMs,
        avg_step_duration_ms: avgStepDurationMs,
      },
    };
  }

  /**
   * Get metrics in Prometheus format (enhanced if available)
   */
  async getPrometheusMetrics(tenantId?: string, enhanced: boolean = true): Promise<string> {
    if (enhanced) {
      return this.enhancedMetrics.getPrometheusMetrics(tenantId);
    }
    const metrics = await this.getMetricsSnapshot(tenantId);
    const lines: string[] = [];

    // Runs metrics
    lines.push(`# HELP runs_total Total number of runs`);
    lines.push(`# TYPE runs_total counter`);
    lines.push(`runs_total{tenant="${tenantId || 'all'}"} ${metrics.runs.total}`);

    Object.entries(metrics.runs.by_status).forEach(([status, count]) => {
      lines.push(`runs_total{status="${status}",tenant="${tenantId || 'all'}"} ${count}`);
    });

    // LLM metrics
    lines.push(`# HELP llm_calls_total Total number of LLM calls`);
    lines.push(`# TYPE llm_calls_total counter`);
    lines.push(`llm_calls_total{tenant="${tenantId || 'all'}"} ${metrics.llm.calls_total}`);

    lines.push(`# HELP llm_tokens_total Total tokens consumed`);
    lines.push(`# TYPE llm_tokens_total counter`);
    lines.push(`llm_tokens_total{tenant="${tenantId || 'all'}"} ${metrics.llm.tokens_total}`);

    lines.push(`# HELP llm_cost_cents_total Total cost in cents`);
    lines.push(`# TYPE llm_cost_cents_total counter`);
    lines.push(`llm_cost_cents_total{tenant="${tenantId || 'all'}"} ${metrics.llm.cost_cents_total}`);

    Object.entries(metrics.llm.by_provider).forEach(([provider, count]) => {
      lines.push(`llm_calls_total{provider="${provider}",tenant="${tenantId || 'all'}"} ${count}`);
    });

    // Tool metrics
    lines.push(`# HELP tool_calls_total Total number of tool calls`);
    lines.push(`# TYPE tool_calls_total counter`);
    lines.push(`tool_calls_total{tenant="${tenantId || 'all'}"} ${metrics.tools.calls_total}`);

    Object.entries(metrics.tools.by_tool).forEach(([tool, count]) => {
      lines.push(`tool_calls_total{tool="${tool}",tenant="${tenantId || 'all'}"} ${count}`);
    });

    // Policy metrics
    lines.push(`# HELP policy_evaluations_total Total number of policy evaluations`);
    lines.push(`# TYPE policy_evaluations_total counter`);
    lines.push(
      `policy_evaluations_total{tenant="${tenantId || 'all'}"} ${metrics.policies.evaluations_total}`,
    );

    lines.push(`# HELP policy_denials_total Total number of policy denials`);
    lines.push(`# TYPE policy_denials_total counter`);
    lines.push(
      `policy_denials_total{tenant="${tenantId || 'all'}"} ${metrics.policies.denials_total}`,
    );

    // Error metrics
    lines.push(`# HELP errors_total Total number of errors`);
    lines.push(`# TYPE errors_total counter`);
    lines.push(`errors_total{tenant="${tenantId || 'all'}"} ${metrics.errors.total}`);

    // Performance metrics
    lines.push(`# HELP avg_run_duration_ms Average run duration in milliseconds`);
    lines.push(`# TYPE avg_run_duration_ms gauge`);
    lines.push(
      `avg_run_duration_ms{tenant="${tenantId || 'all'}"} ${metrics.performance.avg_run_duration_ms}`,
    );

    return lines.join('\n');
  }
}

