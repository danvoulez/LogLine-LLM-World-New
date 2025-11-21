import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Event, EventKind } from '../runs/entities/event.entity';
import { Step, StepStatus } from '../runs/entities/step.entity';
import { MemoryItem } from '../memory/entities/memory-item.entity';
/**
 * Enhanced metrics with additional granularity and observability
 * Based on best practices for LLM agent systems observability
 * 
 * References:
 * - LangSmith observability patterns
 * - OpenAI Assistants API metrics
 * - Prometheus best practices for distributed systems
 */
export interface EnhancedMetricsSnapshot {
  timestamp: Date;
  runs: {
    total: number;
    by_status: Record<RunStatus, number>;
    completed_today: number;
    failed_today: number;
    paused_today: number;
    running_now: number;
    by_workflow: Record<string, number>;
    by_app: Record<string, number>;
    by_mode: Record<'draft' | 'auto', number>;
    throughput_per_hour: number; // runs/hour
    success_rate: number; // completed / (completed + failed)
  };
  llm: {
    calls_total: number;
    calls_today: number;
    tokens_total: number;
    tokens_today: number;
    tokens_prompt_total: number;
    tokens_completion_total: number;
    cost_cents_total: number;
    cost_cents_today: number;
    by_provider: Record<string, number>;
    by_model: Record<string, number>; // e.g., 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'
    by_agent: Record<string, number>; // calls per agent
    avg_latency_ms: number; // average LLM call latency
    latency_p50_ms: number; // 50th percentile
    latency_p95_ms: number; // 95th percentile
    latency_p99_ms: number; // 99th percentile
    error_rate: number; // failed calls / total calls
  };
  tools: {
    calls_total: number;
    calls_today: number;
    by_tool: Record<string, number>;
    by_risk_level: Record<'low' | 'medium' | 'high', number>;
    avg_duration_ms: number;
    error_rate: number;
    throughput_per_hour: number;
  };
  policies: {
    evaluations_total: number;
    evaluations_today: number;
    denials_total: number;
    denials_today: number;
    approvals_total: number;
    approvals_today: number;
    requires_approval_total: number;
    requires_approval_today: number;
    by_scope: Record<string, number>; // global, tenant, app, tool, agent
    denial_rate: number; // denials / evaluations
  };
  memory: {
    items_total: number;
    items_by_type: Record<string, number>; // short_term, long_term, profile
    items_by_owner: Record<string, number>; // user, tenant, app, agent, run
    operations_today: {
      store: number;
      retrieve: number;
      search: number;
      delete: number;
    };
    search_avg_latency_ms: number;
    search_avg_results: number; // average results per search
  };
  errors: {
    total: number;
    today: number;
    by_type: Record<string, number>;
    by_severity: Record<'low' | 'medium' | 'high', number>;
    error_rate: number; // errors / total operations
  };
  performance: {
    avg_run_duration_ms: number;
    run_duration_p50_ms: number;
    run_duration_p95_ms: number;
    run_duration_p99_ms: number;
    avg_step_duration_ms: number;
    step_duration_p50_ms: number;
    step_duration_p95_ms: number;
    step_duration_p99_ms: number;
    steps_per_run_avg: number;
    throughput_runs_per_hour: number;
    throughput_steps_per_hour: number;
  };
  budgets: {
    runs_with_budget: number;
    budget_exceeded_total: number;
    budget_exceeded_today: number;
    by_type: {
      cost_exceeded: number;
      llm_calls_exceeded: number;
      latency_exceeded: number;
    };
    avg_cost_per_run_cents: number;
    avg_llm_calls_per_run: number;
  };
  rate_limiting: {
    hits_total: number;
    blocks_total: number;
    blocks_today: number;
    by_type: Record<'user' | 'tenant' | 'api_key' | 'ip', number>;
    block_rate: number; // blocks / (hits + blocks)
  };
  agents: {
    total_agents: number;
    active_agents: number; // agents used in last 24h
    calls_by_agent: Record<string, number>;
    avg_tool_calls_per_agent: Record<string, number>;
  };
  workflows: {
    total_workflows: number;
    active_workflows: number; // workflows executed in last 24h
    runs_by_workflow: Record<string, number>;
    success_rate_by_workflow: Record<string, number>;
  };
  apps: {
    total_apps: number;
    active_apps: number; // apps with runs in last 24h
    runs_by_app: Record<string, number>;
    actions_by_app: Record<string, number>;
  };
}

@Injectable()
export class EnhancedMetricsService {
  private readonly logger = new Logger(EnhancedMetricsService.name);

  constructor(
    @InjectRepository(Run)
    private runRepository: Repository<Run>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    @InjectRepository(MemoryItem)
    private memoryRepository: Repository<MemoryItem>,
  ) {}

  /**
   * Get enhanced metrics snapshot with granular observability
   */
  async getEnhancedMetricsSnapshot(tenantId?: string): Promise<EnhancedMetricsSnapshot> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last24h = new Date(now);
    last24h.setHours(last24h.getHours() - 24);

    const whereClause = tenantId ? { tenant_id: tenantId } : {};
    // Use parameterized queries to prevent SQL injection
    const tenantCondition = tenantId ? { tenant_id: tenantId } : {};

    // ============================================
    // Enhanced Runs Metrics
    // ============================================
    const runsTotal = await this.runRepository.count({ where: whereClause });

    // Runs by status
    const runsByStatusQuery = this.runRepository
      .createQueryBuilder('run')
      .select('run.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('run.status');
    
    if (tenantId) {
      runsByStatusQuery.where('run.tenant_id = :tenantId', { tenantId });
    }
    
    const runsByStatus = await runsByStatusQuery.getRawMany();

    const runsByStatusMap: Record<string, number> = {};
    runsByStatus.forEach((row) => {
      runsByStatusMap[row.status] = parseInt(row.count, 10);
    });

    // Runs today
    const runsCompletedTodayQuery = this.runRepository
      .createQueryBuilder('run')
      .where('run.status = :status', { status: RunStatus.COMPLETED })
      .andWhere('run.created_at >= :today', { today });
    if (tenantId) {
      runsCompletedTodayQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const runsCompletedToday = await runsCompletedTodayQuery.getCount();

    const runsFailedTodayQuery = this.runRepository
      .createQueryBuilder('run')
      .where('run.status = :status', { status: RunStatus.FAILED })
      .andWhere('run.created_at >= :today', { today });
    if (tenantId) {
      runsFailedTodayQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const runsFailedToday = await runsFailedTodayQuery.getCount();

    const runsPausedTodayQuery = this.runRepository
      .createQueryBuilder('run')
      .where('run.status = :status', { status: RunStatus.PAUSED })
      .andWhere('run.created_at >= :today', { today });
    if (tenantId) {
      runsPausedTodayQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const runsPausedToday = await runsPausedTodayQuery.getCount();

    const runsRunningNow = await this.runRepository.count({
      where: { ...whereClause, status: RunStatus.RUNNING },
    });

    // Runs by workflow
    const runsByWorkflowQuery = this.runRepository
      .createQueryBuilder('run')
      .select('run.workflow_id', 'workflow_id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('run.workflow_id');
    if (tenantId) {
      runsByWorkflowQuery.where('run.tenant_id = :tenantId', { tenantId });
    }
    const runsByWorkflow = await runsByWorkflowQuery.getRawMany();

    const runsByWorkflowMap: Record<string, number> = {};
    runsByWorkflow.forEach((row) => {
      runsByWorkflowMap[row.workflow_id] = parseInt(row.count, 10);
    });

    // Runs by app
    const runsByAppQuery = this.runRepository
      .createQueryBuilder('run')
      .select('run.app_id', 'app_id')
      .addSelect('COUNT(*)', 'count')
      .where('run.app_id IS NOT NULL')
      .groupBy('run.app_id');
    if (tenantId) {
      runsByAppQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const runsByApp = await runsByAppQuery.getRawMany();

    const runsByAppMap: Record<string, number> = {};
    runsByApp.forEach((row) => {
      runsByAppMap[row.app_id] = parseInt(row.count, 10);
    });

    // Runs by mode
    const runsByModeQuery = this.runRepository
      .createQueryBuilder('run')
      .select('run.mode', 'mode')
      .addSelect('COUNT(*)', 'count')
      .groupBy('run.mode');
    if (tenantId) {
      runsByModeQuery.where('run.tenant_id = :tenantId', { tenantId });
    }
    const runsByMode = await runsByModeQuery.getRawMany();

    const runsByModeMap: Record<string, number> = { draft: 0, auto: 0 };
    runsByMode.forEach((row) => {
      runsByModeMap[row.mode] = parseInt(row.count, 10);
    });

    // Throughput: runs per hour (last 24h)
    const runsLast24hQuery = this.runRepository
      .createQueryBuilder('run')
      .where('run.created_at >= :last24h', { last24h });
    if (tenantId) {
      runsLast24hQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const runsLast24h = await runsLast24hQuery.getCount();
    const throughputRunsPerHour = runsLast24h / 24;

    // Success rate
    const completed = runsByStatusMap[RunStatus.COMPLETED] || 0;
    const failed = runsByStatusMap[RunStatus.FAILED] || 0;
    const successRate = completed + failed > 0 ? completed / (completed + failed) : 0;

    // ============================================
    // Enhanced LLM Metrics
    // ============================================
    const llmEventsQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.LLM_CALL });
    if (tenantId) {
      llmEventsQuery.andWhere(`event.payload->>'tenant_id' = :tenantId`, { tenantId });
    }
    const llmEvents = await llmEventsQuery.getMany();

    const llmCallsTotal = llmEvents.length;
    const llmCallsToday = llmEvents.filter((e) => e.ts && new Date(e.ts) >= today).length;

    let tokensTotal = 0;
    let tokensToday = 0;
    let tokensPromptTotal = 0;
    let tokensCompletionTotal = 0;
    let costCentsTotal = 0;
    let costCentsToday = 0;
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const latencies: number[] = [];

    llmEvents.forEach((event) => {
      const payload = event.payload as any;
      const usage = payload.usage || {};
      const promptTokens = usage.promptTokens || 0;
      const completionTokens = usage.completionTokens || 0;
      const tokens = promptTokens + completionTokens;
      tokensTotal += tokens;
      tokensPromptTotal += promptTokens;
      tokensCompletionTotal += completionTokens;

      const cost = payload.estimated_cost_cents || 0;
      costCentsTotal += cost;

      const provider = payload.provider || 'unknown';
      byProvider[provider] = (byProvider[provider] || 0) + 1;

      const model = payload.model || 'unknown';
      byModel[model] = (byModel[model] || 0) + 1;

      const agentId = payload.agent_id || 'unknown';
      byAgent[agentId] = (byAgent[agentId] || 0) + 1;

      // Latency (if available in payload)
      if (payload.latency_ms) {
        latencies.push(payload.latency_ms);
      }

      if (event.ts && new Date(event.ts) >= today) {
        tokensToday += tokens;
        costCentsToday += cost;
      }
    });

    // Calculate latency percentiles
    latencies.sort((a, b) => a - b);
    const latencyP50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const latencyP95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const latencyP99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    // LLM error rate (from error events linked to LLM calls)
    const llmErrorEventsQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.ERROR })
      .andWhere(`event.payload->>'error_type' = 'LLMError'`);
    if (tenantId) {
      llmErrorEventsQuery.andWhere(`event.payload->>'tenant_id' = :tenantId`, { tenantId });
    }
    const llmErrorEvents = await llmErrorEventsQuery.getCount();
    const llmErrorRate = llmCallsTotal > 0 ? llmErrorEvents / llmCallsTotal : 0;

    // ============================================
    // Enhanced Tool Metrics
    // ============================================
    const toolEventsQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.TOOL_CALL });
    if (tenantId) {
      toolEventsQuery.andWhere(`event.payload->>'tenant_id' = :tenantId`, { tenantId });
    }
    const toolEvents = await toolEventsQuery.getMany();

    const toolCallsTotal = toolEvents.length;
    const toolCallsToday = toolEvents.filter((e) => e.ts && new Date(e.ts) >= today).length;

    const byTool: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = { low: 0, medium: 0, high: 0 };
    const toolDurations: number[] = [];
    let toolErrors = 0;

    toolEvents.forEach((event) => {
      const payload = event.payload as any;
      const toolId = payload.tool_id || 'unknown';
      byTool[toolId] = (byTool[toolId] || 0) + 1;

      const riskLevel = payload.risk_level || 'low';
      byRiskLevel[riskLevel] = (byRiskLevel[riskLevel] || 0) + 1;

      if (payload.duration_ms) {
        toolDurations.push(payload.duration_ms);
      }

      if (payload.error) {
        toolErrors++;
      }
    });

    const avgToolDuration = toolDurations.length > 0
      ? toolDurations.reduce((a, b) => a + b, 0) / toolDurations.length
      : 0;
    const toolErrorRate = toolCallsTotal > 0 ? toolErrors / toolCallsTotal : 0;
    const toolThroughputPerHour = toolCallsToday / 24;

    // ============================================
    // Enhanced Policy Metrics
    // ============================================
    const policyEventsQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.POLICY_EVAL });
    if (tenantId) {
      policyEventsQuery.andWhere(`event.payload->>'tenant_id' = :tenantId`, { tenantId });
    }
    const policyEvents = await policyEventsQuery.getMany();

    const policyEvalsTotal = policyEvents.length;
    const policyEvalsToday = policyEvents.filter((e) => e.ts && new Date(e.ts) >= today).length;

    let denialsTotal = 0;
    let denialsToday = 0;
    let approvalsTotal = 0;
    let approvalsToday = 0;
    let requiresApprovalTotal = 0;
    let requiresApprovalToday = 0;
    const byScope: Record<string, number> = {};

    policyEvents.forEach((event) => {
      const payload = event.payload as any;
      const result = payload.result || 'unknown';
      const scope = payload.scope || 'global';

      byScope[scope] = (byScope[scope] || 0) + 1;

      if (result === 'denied') {
        denialsTotal++;
        if (event.ts && new Date(event.ts) >= today) {
          denialsToday++;
        }
      } else if (result === 'allowed') {
        approvalsTotal++;
        if (event.ts && new Date(event.ts) >= today) {
          approvalsToday++;
        }
      } else if (result === 'requires_approval') {
        requiresApprovalTotal++;
        if (event.ts && new Date(event.ts) >= today) {
          requiresApprovalToday++;
        }
      }
    });

    const denialRate = policyEvalsTotal > 0 ? denialsTotal / policyEvalsTotal : 0;

    // ============================================
    // Real Memory Metrics
    // ============================================
    const memoryItemsTotal = await this.memoryRepository.count(
      tenantId ? { where: { owner_id: tenantId, owner_type: 'tenant' } } : {},
    );

    const memoryByTypeQuery = this.memoryRepository
      .createQueryBuilder('memory')
      .select('memory.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('memory.type');
    if (tenantId) {
      memoryByTypeQuery.where('memory.owner_id = :tenantId AND memory.owner_type = :ownerType', {
        tenantId,
        ownerType: 'tenant',
      });
    }
    const memoryByType = await memoryByTypeQuery.getRawMany();

    const memoryByTypeMap: Record<string, number> = {};
    memoryByType.forEach((row) => {
      memoryByTypeMap[row.type] = parseInt(row.count, 10);
    });

    const memoryByOwnerQuery = this.memoryRepository
      .createQueryBuilder('memory')
      .select('memory.owner_type', 'owner_type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('memory.owner_type');
    if (tenantId) {
      memoryByOwnerQuery.where('memory.owner_id = :tenantId', { tenantId });
    }
    const memoryByOwner = await memoryByOwnerQuery.getRawMany();

    const memoryByOwnerMap: Record<string, number> = {};
    memoryByOwner.forEach((row) => {
      memoryByOwnerMap[row.owner_type] = parseInt(row.count, 10);
    });

    // Memory operations from events (if we track them)
    const memoryOpsToday = {
      store: 0,
      retrieve: 0,
      search: 0,
      delete: 0,
    };

    // ============================================
    // Enhanced Error Metrics
    // ============================================
    const errorEventsQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.ERROR });
    if (tenantId) {
      errorEventsQuery.andWhere(`event.payload->>'tenant_id' = :tenantId`, { tenantId });
    }
    const errorEvents = await errorEventsQuery.getMany();

    const errorsTotal = errorEvents.length;
    const errorsToday = errorEvents.filter((e) => e.ts && new Date(e.ts) >= today).length;

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = { low: 0, medium: 0, high: 0 };

    errorEvents.forEach((event) => {
      const payload = event.payload as any;
      const errorType = payload.error_type || 'unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

      // Infer severity from error type
      const severity = this.inferErrorSeverity(errorType);
      errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;
    });

    const totalOperations = runsTotal + toolCallsTotal + llmCallsTotal;
    const errorRate = totalOperations > 0 ? errorsTotal / totalOperations : 0;

    // ============================================
    // Enhanced Performance Metrics with Percentiles
    // ============================================
    const completedRuns = await this.runRepository.find({
      where: {
        ...whereClause,
        status: RunStatus.COMPLETED,
      },
      take: 1000, // Larger sample for percentiles
      order: { created_at: 'DESC' },
    });

    const runDurations: number[] = [];
    let totalSteps = 0;

    for (const run of completedRuns) {
      if (run.created_at && run.updated_at) {
        const duration = new Date(run.updated_at).getTime() - new Date(run.created_at).getTime();
        runDurations.push(duration);
      }

      // Count steps for this run
      const stepCount = await this.stepRepository.count({ where: { run_id: run.id } });
      totalSteps += stepCount;
    }

    runDurations.sort((a, b) => a - b);
    const avgRunDuration = runDurations.length > 0
      ? runDurations.reduce((a, b) => a + b, 0) / runDurations.length
      : 0;
    const runDurationP50 = runDurations.length > 0 ? runDurations[Math.floor(runDurations.length * 0.5)] : 0;
    const runDurationP95 = runDurations.length > 0 ? runDurations[Math.floor(runDurations.length * 0.95)] : 0;
    const runDurationP99 = runDurations.length > 0 ? runDurations[Math.floor(runDurations.length * 0.99)] : 0;

    const completedSteps = await this.stepRepository.find({
      where: {
        status: StepStatus.COMPLETED,
      },
      take: 1000,
      order: { started_at: 'DESC' },
    });

    const stepDurations: number[] = [];

    for (const step of completedSteps) {
      if (step.started_at && step.finished_at) {
        const duration =
          new Date(step.finished_at).getTime() - new Date(step.started_at).getTime();
        stepDurations.push(duration);
      }
    }

    stepDurations.sort((a, b) => a - b);
    const avgStepDuration = stepDurations.length > 0
      ? stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length
      : 0;
    const stepDurationP50 = stepDurations.length > 0
      ? stepDurations[Math.floor(stepDurations.length * 0.5)]
      : 0;
    const stepDurationP95 = stepDurations.length > 0
      ? stepDurations[Math.floor(stepDurations.length * 0.95)]
      : 0;
    const stepDurationP99 = stepDurations.length > 0
      ? stepDurations[Math.floor(stepDurations.length * 0.99)]
      : 0;

    const stepsPerRunAvg = completedRuns.length > 0 ? totalSteps / completedRuns.length : 0;

    // Steps throughput
    const stepsLast24hQuery = this.stepRepository
      .createQueryBuilder('step')
      .innerJoin('step.run', 'run')
      .where('step.created_at >= :last24h', { last24h });
    if (tenantId) {
      stepsLast24hQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const stepsLast24h = await stepsLast24hQuery.getCount();
    const throughputStepsPerHour = stepsLast24h / 24;

    // ============================================
    // Budget Metrics
    // ============================================
    const runsWithBudgetQuery = this.runRepository
      .createQueryBuilder('run')
      .where(
        '(run.cost_limit_cents IS NOT NULL OR run.llm_calls_limit IS NOT NULL OR run.latency_slo_ms IS NOT NULL)',
      );
    if (tenantId) {
      runsWithBudgetQuery.andWhere('run.tenant_id = :tenantId', { tenantId });
    }
    const runsWithBudget = await runsWithBudgetQuery.getCount();

    const budgetExceededEventsQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.kind = :kind', { kind: EventKind.ERROR })
      .andWhere(`event.payload->>'error' LIKE '%budget_exceeded%'`);
    if (tenantId) {
      budgetExceededEventsQuery.andWhere(`event.payload->>'tenant_id' = :tenantId`, { tenantId });
    }
    const budgetExceededEvents = await budgetExceededEventsQuery.getMany();

    const budgetExceededTotal = budgetExceededEvents.length;
    const budgetExceededToday = budgetExceededEvents.filter((e) => e.ts && new Date(e.ts) >= today).length;

    const budgetByType = {
      cost_exceeded: 0,
      llm_calls_exceeded: 0,
      latency_exceeded: 0,
    };

    budgetExceededEvents.forEach((event) => {
      const payload = event.payload as any;
      const reason = payload.reason || '';
      if (reason.includes('cost')) budgetByType.cost_exceeded++;
      if (reason.includes('llm_calls')) budgetByType.llm_calls_exceeded++;
      if (reason.includes('latency')) budgetByType.latency_exceeded++;
    });

    // Average cost per run
    const avgCostPerRun = completedRuns.length > 0 ? costCentsTotal / completedRuns.length : 0;
    const avgLlmCallsPerRun = completedRuns.length > 0 ? llmCallsTotal / completedRuns.length : 0;

    // ============================================
    // Rate Limiting Metrics (placeholder - would need RateLimitService integration)
    // ============================================
    const rateLimitingMetrics = {
      hits_total: 0,
      blocks_total: 0,
      blocks_today: 0,
      by_type: { user: 0, tenant: 0, api_key: 0, ip: 0 } as Record<string, number>,
      block_rate: 0,
    };

    // ============================================
    // Agents Metrics
    // ============================================
    const agentsMetrics = {
      total_agents: 0, // Would need Agent repository
      active_agents: 0,
      calls_by_agent: byAgent,
      avg_tool_calls_per_agent: {} as Record<string, number>,
    };

    // ============================================
    // Workflows Metrics
    // ============================================
    const workflowsMetrics = {
      total_workflows: 0, // Would need Workflow repository
      active_workflows: Object.keys(runsByWorkflowMap).length,
      runs_by_workflow: runsByWorkflowMap,
      success_rate_by_workflow: {} as Record<string, number>,
    };

    // ============================================
    // Apps Metrics
    // ============================================
    const appsMetrics = {
      total_apps: 0, // Would need App repository
      active_apps: Object.keys(runsByAppMap).length,
      runs_by_app: runsByAppMap,
      actions_by_app: {} as Record<string, number>,
    };

    return {
      timestamp: now,
      runs: {
        total: runsTotal,
        by_status: runsByStatusMap as Record<RunStatus, number>,
        completed_today: runsCompletedToday,
        failed_today: runsFailedToday,
        paused_today: runsPausedToday,
        running_now: runsRunningNow,
        by_workflow: runsByWorkflowMap,
        by_app: runsByAppMap,
        by_mode: runsByModeMap as Record<'draft' | 'auto', number>,
        throughput_per_hour: throughputRunsPerHour,
        success_rate: successRate,
      },
      llm: {
        calls_total: llmCallsTotal,
        calls_today: llmCallsToday,
        tokens_total: tokensTotal,
        tokens_today: tokensToday,
        tokens_prompt_total: tokensPromptTotal,
        tokens_completion_total: tokensCompletionTotal,
        cost_cents_total: costCentsTotal,
        cost_cents_today: costCentsToday,
        by_provider: byProvider,
        by_model: byModel,
        by_agent: byAgent,
        avg_latency_ms: avgLatency,
        latency_p50_ms: latencyP50,
        latency_p95_ms: latencyP95,
        latency_p99_ms: latencyP99,
        error_rate: llmErrorRate,
      },
      tools: {
        calls_total: toolCallsTotal,
        calls_today: toolCallsToday,
        by_tool: byTool,
        by_risk_level: byRiskLevel as Record<'low' | 'medium' | 'high', number>,
        avg_duration_ms: avgToolDuration,
        error_rate: toolErrorRate,
        throughput_per_hour: toolThroughputPerHour,
      },
      policies: {
        evaluations_total: policyEvalsTotal,
        evaluations_today: policyEvalsToday,
        denials_total: denialsTotal,
        denials_today: denialsToday,
        approvals_total: approvalsTotal,
        approvals_today: approvalsToday,
        requires_approval_total: requiresApprovalTotal,
        requires_approval_today: requiresApprovalToday,
        by_scope: byScope,
        denial_rate: denialRate,
      },
      memory: {
        items_total: memoryItemsTotal,
        items_by_type: memoryByTypeMap,
        items_by_owner: memoryByOwnerMap,
        operations_today: memoryOpsToday,
        search_avg_latency_ms: 0, // Would need to track search operations
        search_avg_results: 0, // Would need to track search operations
      },
      errors: {
        total: errorsTotal,
        today: errorsToday,
        by_type: errorsByType,
        by_severity: errorsBySeverity as Record<'low' | 'medium' | 'high', number>,
        error_rate: errorRate,
      },
      performance: {
        avg_run_duration_ms: avgRunDuration,
        run_duration_p50_ms: runDurationP50,
        run_duration_p95_ms: runDurationP95,
        run_duration_p99_ms: runDurationP99,
        avg_step_duration_ms: avgStepDuration,
        step_duration_p50_ms: stepDurationP50,
        step_duration_p95_ms: stepDurationP95,
        step_duration_p99_ms: stepDurationP99,
        steps_per_run_avg: stepsPerRunAvg,
        throughput_runs_per_hour: throughputRunsPerHour,
        throughput_steps_per_hour: throughputStepsPerHour,
      },
      budgets: {
        runs_with_budget: runsWithBudget,
        budget_exceeded_total: budgetExceededTotal,
        budget_exceeded_today: budgetExceededToday,
        by_type: budgetByType,
        avg_cost_per_run_cents: avgCostPerRun,
        avg_llm_calls_per_run: avgLlmCallsPerRun,
      },
      rate_limiting: rateLimitingMetrics,
      agents: agentsMetrics,
      workflows: workflowsMetrics,
      apps: appsMetrics,
    };
  }

  /**
   * Get enhanced metrics in Prometheus format
   */
  async getPrometheusMetrics(tenantId?: string): Promise<string> {
    const metrics = await this.getEnhancedMetricsSnapshot(tenantId);
    const lines: string[] = [];
    const tenantLabel = tenantId || 'all';

    // Runs metrics
    lines.push(`# HELP runs_total Total number of runs`);
    lines.push(`# TYPE runs_total counter`);
    lines.push(`runs_total{tenant="${tenantLabel}"} ${metrics.runs.total}`);

    Object.entries(metrics.runs.by_status).forEach(([status, count]) => {
      lines.push(`runs_total{status="${status}",tenant="${tenantLabel}"} ${count}`);
    });

    lines.push(`# HELP runs_throughput_per_hour Runs per hour (last 24h)`);
    lines.push(`# TYPE runs_throughput_per_hour gauge`);
    lines.push(`runs_throughput_per_hour{tenant="${tenantLabel}"} ${metrics.runs.throughput_per_hour}`);

    lines.push(`# HELP runs_success_rate Success rate (completed / (completed + failed))`);
    lines.push(`# TYPE runs_success_rate gauge`);
    lines.push(`runs_success_rate{tenant="${tenantLabel}"} ${metrics.runs.success_rate}`);

    // LLM metrics
    lines.push(`# HELP llm_calls_total Total number of LLM calls`);
    lines.push(`# TYPE llm_calls_total counter`);
    lines.push(`llm_calls_total{tenant="${tenantLabel}"} ${metrics.llm.calls_total}`);

    lines.push(`# HELP llm_tokens_total Total tokens consumed`);
    lines.push(`# TYPE llm_tokens_total counter`);
    lines.push(`llm_tokens_total{tenant="${tenantLabel}"} ${metrics.llm.tokens_total}`);

    lines.push(`# HELP llm_tokens_prompt_total Total prompt tokens`);
    lines.push(`# TYPE llm_tokens_prompt_total counter`);
    lines.push(`llm_tokens_prompt_total{tenant="${tenantLabel}"} ${metrics.llm.tokens_prompt_total}`);

    lines.push(`# HELP llm_tokens_completion_total Total completion tokens`);
    lines.push(`# TYPE llm_tokens_completion_total counter`);
    lines.push(`llm_tokens_completion_total{tenant="${tenantLabel}"} ${metrics.llm.tokens_completion_total}`);

    lines.push(`# HELP llm_cost_cents_total Total cost in cents`);
    lines.push(`# TYPE llm_cost_cents_total counter`);
    lines.push(`llm_cost_cents_total{tenant="${tenantLabel}"} ${metrics.llm.cost_cents_total}`);

    lines.push(`# HELP llm_latency_ms Average LLM call latency in milliseconds`);
    lines.push(`# TYPE llm_latency_ms gauge`);
    lines.push(`llm_latency_ms{percentile="avg",tenant="${tenantLabel}"} ${metrics.llm.avg_latency_ms}`);
    lines.push(`llm_latency_ms{percentile="p50",tenant="${tenantLabel}"} ${metrics.llm.latency_p50_ms}`);
    lines.push(`llm_latency_ms{percentile="p95",tenant="${tenantLabel}"} ${metrics.llm.latency_p95_ms}`);
    lines.push(`llm_latency_ms{percentile="p99",tenant="${tenantLabel}"} ${metrics.llm.latency_p99_ms}`);

    lines.push(`# HELP llm_error_rate LLM error rate`);
    lines.push(`# TYPE llm_error_rate gauge`);
    lines.push(`llm_error_rate{tenant="${tenantLabel}"} ${metrics.llm.error_rate}`);

    Object.entries(metrics.llm.by_provider).forEach(([provider, count]) => {
      lines.push(`llm_calls_total{provider="${provider}",tenant="${tenantLabel}"} ${count}`);
    });

    Object.entries(metrics.llm.by_model).forEach(([model, count]) => {
      lines.push(`llm_calls_total{model="${model}",tenant="${tenantLabel}"} ${count}`);
    });

    // Tool metrics
    lines.push(`# HELP tool_calls_total Total number of tool calls`);
    lines.push(`# TYPE tool_calls_total counter`);
    lines.push(`tool_calls_total{tenant="${tenantLabel}"} ${metrics.tools.calls_total}`);

    lines.push(`# HELP tool_avg_duration_ms Average tool execution duration`);
    lines.push(`# TYPE tool_avg_duration_ms gauge`);
    lines.push(`tool_avg_duration_ms{tenant="${tenantLabel}"} ${metrics.tools.avg_duration_ms}`);

    lines.push(`# HELP tool_error_rate Tool error rate`);
    lines.push(`# TYPE tool_error_rate gauge`);
    lines.push(`tool_error_rate{tenant="${tenantLabel}"} ${metrics.tools.error_rate}`);

    Object.entries(metrics.tools.by_tool).forEach(([tool, count]) => {
      lines.push(`tool_calls_total{tool="${tool}",tenant="${tenantLabel}"} ${count}`);
    });

    Object.entries(metrics.tools.by_risk_level).forEach(([risk, count]) => {
      lines.push(`tool_calls_total{risk_level="${risk}",tenant="${tenantLabel}"} ${count}`);
    });

    // Policy metrics
    lines.push(`# HELP policy_evaluations_total Total number of policy evaluations`);
    lines.push(`# TYPE policy_evaluations_total counter`);
    lines.push(`policy_evaluations_total{tenant="${tenantLabel}"} ${metrics.policies.evaluations_total}`);

    lines.push(`# HELP policy_denial_rate Policy denial rate`);
    lines.push(`# TYPE policy_denial_rate gauge`);
    lines.push(`policy_denial_rate{tenant="${tenantLabel}"} ${metrics.policies.denial_rate}`);

    // Performance metrics
    lines.push(`# HELP run_duration_ms Run execution duration in milliseconds`);
    lines.push(`# TYPE run_duration_ms gauge`);
    lines.push(`run_duration_ms{percentile="avg",tenant="${tenantLabel}"} ${metrics.performance.avg_run_duration_ms}`);
    lines.push(`run_duration_ms{percentile="p50",tenant="${tenantLabel}"} ${metrics.performance.run_duration_p50_ms}`);
    lines.push(`run_duration_ms{percentile="p95",tenant="${tenantLabel}"} ${metrics.performance.run_duration_p95_ms}`);
    lines.push(`run_duration_ms{percentile="p99",tenant="${tenantLabel}"} ${metrics.performance.run_duration_p99_ms}`);

    lines.push(`# HELP step_duration_ms Step execution duration in milliseconds`);
    lines.push(`# TYPE step_duration_ms gauge`);
    lines.push(`step_duration_ms{percentile="avg",tenant="${tenantLabel}"} ${metrics.performance.avg_step_duration_ms}`);
    lines.push(`step_duration_ms{percentile="p50",tenant="${tenantLabel}"} ${metrics.performance.step_duration_p50_ms}`);
    lines.push(`step_duration_ms{percentile="p95",tenant="${tenantLabel}"} ${metrics.performance.step_duration_p95_ms}`);
    lines.push(`step_duration_ms{percentile="p99",tenant="${tenantLabel}"} ${metrics.performance.step_duration_p99_ms}`);

    // Budget metrics
    lines.push(`# HELP budget_exceeded_total Total budget exceeded events`);
    lines.push(`# TYPE budget_exceeded_total counter`);
    lines.push(`budget_exceeded_total{tenant="${tenantLabel}"} ${metrics.budgets.budget_exceeded_total}`);

    lines.push(`# HELP avg_cost_per_run_cents Average cost per run in cents`);
    lines.push(`# TYPE avg_cost_per_run_cents gauge`);
    lines.push(`avg_cost_per_run_cents{tenant="${tenantLabel}"} ${metrics.budgets.avg_cost_per_run_cents}`);

    // Memory metrics
    lines.push(`# HELP memory_items_total Total memory items`);
    lines.push(`# TYPE memory_items_total gauge`);
    lines.push(`memory_items_total{tenant="${tenantLabel}"} ${metrics.memory.items_total}`);

    // Error metrics
    lines.push(`# HELP errors_total Total number of errors`);
    lines.push(`# TYPE errors_total counter`);
    lines.push(`errors_total{tenant="${tenantLabel}"} ${metrics.errors.total}`);

    lines.push(`# HELP error_rate Error rate`);
    lines.push(`# TYPE error_rate gauge`);
    lines.push(`error_rate{tenant="${tenantLabel}"} ${metrics.errors.error_rate}`);

    return lines.join('\n');
  }

  /**
   * Infer error severity from error type
   */
  private inferErrorSeverity(errorType: string): 'low' | 'medium' | 'high' {
    const highSeverity = ['SecurityError', 'DatabaseError', 'PolicyDenied', 'BudgetExceeded'];
    const mediumSeverity = ['ValidationError', 'ToolExecutionException', 'AgentExecutionException'];

    if (highSeverity.some((type) => errorType.includes(type))) {
      return 'high';
    }
    if (mediumSeverity.some((type) => errorType.includes(type))) {
      return 'medium';
    }
    return 'low';
  }
}

