# Enhanced Metrics Coverage

**Date:** 2024-12-19  
**Status:** ✅ **IMPLEMENTED**

---

## Overview

Enhanced metrics system with comprehensive observability coverage based on best practices for LLM agent systems. References include LangSmith observability patterns, OpenAI Assistants API metrics, and Prometheus best practices.

---

## New Metrics Added

### 1. **Granular LLM Metrics**
- ✅ **By Model**: Breakdown of LLM calls by model (e.g., `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet`)
- ✅ **By Agent**: LLM calls per agent
- ✅ **Token Breakdown**: Separate tracking for prompt tokens vs completion tokens
- ✅ **Latency Percentiles**: p50, p95, p99 for LLM call latency
- ✅ **Error Rate**: LLM-specific error rate

### 2. **Budget Tracking Metrics**
- ✅ **Runs with Budget**: Count of runs that have budget limits set
- ✅ **Budget Exceeded**: Total and today's budget exceeded events
- ✅ **By Type**: Breakdown by cost, LLM calls, latency SLO
- ✅ **Average Cost per Run**: Average cost in cents per completed run
- ✅ **Average LLM Calls per Run**: Average LLM calls per completed run

### 3. **Real Memory Metrics**
- ✅ **Items Total**: Total memory items (not placeholder)
- ✅ **By Type**: Breakdown by `short_term`, `long_term`, `profile`
- ✅ **By Owner**: Breakdown by `user`, `tenant`, `app`, `agent`, `run`
- ✅ **Operations Today**: Store, retrieve, search, delete operations
- ✅ **Search Performance**: Average latency and results (placeholder for future tracking)

### 4. **Throughput Metrics**
- ✅ **Runs per Hour**: Throughput of runs (last 24h)
- ✅ **Steps per Hour**: Throughput of steps (last 24h)
- ✅ **Tool Calls per Hour**: Throughput of tool calls (last 24h)

### 5. **Quality Metrics**
- ✅ **Success Rate**: Completed runs / (completed + failed)
- ✅ **Error Rate**: Errors / total operations
- ✅ **Tool Error Rate**: Tool-specific error rate
- ✅ **LLM Error Rate**: LLM-specific error rate
- ✅ **Policy Denial Rate**: Policy denials / evaluations

### 6. **Latency Percentiles**
- ✅ **Run Duration**: p50, p95, p99 percentiles
- ✅ **Step Duration**: p50, p95, p99 percentiles
- ✅ **LLM Latency**: p50, p95, p99 percentiles
- ✅ **Average Durations**: Mean values for all duration metrics

### 7. **Metrics by Dimension**
- ✅ **By Workflow**: Runs per workflow
- ✅ **By App**: Runs per app
- ✅ **By Mode**: Runs by `draft` vs `auto`
- ✅ **By Tool**: Tool calls per tool
- ✅ **By Risk Level**: Tool calls by `low`, `medium`, `high`
- ✅ **By Policy Scope**: Policy evaluations by scope (global, tenant, app, tool, agent)

### 8. **Enhanced Error Metrics**
- ✅ **By Severity**: Errors classified as `low`, `medium`, `high`
- ✅ **By Type**: Error breakdown by error type
- ✅ **Error Rate**: Overall error rate

### 9. **Enhanced Policy Metrics**
- ✅ **Requires Approval**: Count of `require_approval` decisions
- ✅ **By Scope**: Policy evaluations by scope
- ✅ **Denial Rate**: Policy denial rate

### 10. **Rate Limiting Metrics** (Placeholder)
- Structure ready for integration with `RateLimitService`
- Tracks hits, blocks, block rate, by type (user, tenant, API key, IP)

### 11. **Agents & Workflows Metrics** (Partial)
- ✅ **Calls by Agent**: LLM calls per agent
- ✅ **Runs by Workflow**: Runs per workflow
- ✅ **Active Workflows**: Workflows executed in last 24h
- ⚠️ **Total Agents/Workflows**: Requires repository access (placeholder)

### 12. **Apps Metrics** (Partial)
- ✅ **Runs by App**: Runs per app
- ✅ **Active Apps**: Apps with runs in last 24h
- ⚠️ **Total Apps**: Requires repository access (placeholder)

---

## API Usage

### Enhanced Metrics (Default)
```bash
GET /api/v1/metrics?enhanced=true
GET /api/v1/metrics  # enhanced=true is now default
```

### Legacy Metrics (Backward Compatibility)
```bash
GET /api/v1/metrics?enhanced=false
```

### Prometheus Format (Enhanced)
```bash
GET /api/v1/metrics?format=prometheus
# Now includes percentiles, throughput, granular breakdowns
```

---

## Prometheus Metrics Added

### New Metrics
- `runs_throughput_per_hour` - Runs per hour (gauge)
- `runs_success_rate` - Success rate (gauge)
- `llm_tokens_prompt_total` - Prompt tokens (counter)
- `llm_tokens_completion_total` - Completion tokens (counter)
- `llm_latency_ms{percentile="p50|p95|p99"}` - Latency percentiles (gauge)
- `llm_error_rate` - LLM error rate (gauge)
- `llm_calls_total{model="..."}` - Calls by model (counter)
- `tool_avg_duration_ms` - Average tool duration (gauge)
- `tool_error_rate` - Tool error rate (gauge)
- `tool_calls_total{risk_level="low|medium|high"}` - Calls by risk level (counter)
- `policy_denial_rate` - Policy denial rate (gauge)
- `run_duration_ms{percentile="p50|p95|p99"}` - Run duration percentiles (gauge)
- `step_duration_ms{percentile="p50|p95|p99"}` - Step duration percentiles (gauge)
- `budget_exceeded_total` - Budget exceeded events (counter)
- `avg_cost_per_run_cents` - Average cost per run (gauge)
- `memory_items_total` - Total memory items (gauge)
- `error_rate` - Overall error rate (gauge)

---

## Implementation Details

### Files Created/Modified
- ✅ `backend/src/metrics/enhanced-metrics.service.ts` - New enhanced metrics service
- ✅ `backend/src/metrics/metrics.service.ts` - Integrated enhanced metrics
- ✅ `backend/src/metrics/metrics.controller.ts` - Added `enhanced` query parameter
- ✅ `backend/src/metrics/metrics.module.ts` - Added `MemoryItem` repository and `EnhancedMetricsService`

### Security
- ✅ All queries use parameterized queries (no SQL injection)
- ✅ Tenant filtering properly implemented
- ✅ JSONB queries use parameterized values

### Performance
- ✅ Efficient queries with proper indexing
- ✅ Sample-based percentiles (1000 runs/steps) for performance
- ✅ Cached calculations where possible

---

## References

Based on best practices from:
- **LangSmith**: Observability patterns for LLM agent systems
- **OpenAI Assistants API**: Metrics and monitoring patterns
- **Prometheus**: Best practices for distributed systems observability
- **ISO/IEC 9126**: Software quality metrics model

---

## Future Enhancements

1. **Real-time Metrics**: WebSocket/SSE for live metrics updates
2. **Metrics Aggregation**: Pre-aggregated metrics for faster queries
3. **Custom Dashboards**: Pre-built Grafana dashboards
4. **Alerting Integration**: Direct integration with alert system
5. **Metrics Export**: Export to external monitoring systems (Datadog, New Relic, etc.)
6. **Memory Search Tracking**: Track search latency and results
7. **Rate Limiting Integration**: Real rate limiting metrics from `RateLimitService`
8. **Agent/Workflow/App Totals**: Complete repository access for totals

---

## Usage Examples

### Get Enhanced Metrics
```bash
curl "https://api.example.com/api/v1/metrics?enhanced=true&tenant_id=tenant-123"
```

### Get Prometheus Metrics
```bash
curl "https://api.example.com/api/v1/metrics?format=prometheus&tenant_id=tenant-123"
```

### Response Structure
```json
{
  "timestamp": "2024-12-19T10:00:00Z",
  "runs": {
    "total": 1000,
    "by_status": { "completed": 800, "failed": 50, "running": 10, ... },
    "throughput_per_hour": 42.5,
    "success_rate": 0.94,
    "by_workflow": { "workflow-1": 500, "workflow-2": 300, ... },
    "by_app": { "app-1": 400, "app-2": 200, ... },
    "by_mode": { "draft": 600, "auto": 400 }
  },
  "llm": {
    "calls_total": 5000,
    "tokens_prompt_total": 1000000,
    "tokens_completion_total": 500000,
    "by_model": { "gpt-4o": 3000, "gpt-4o-mini": 2000 },
    "by_agent": { "agent.triage": 2000, "agent.router": 3000 },
    "latency_p50_ms": 1200,
    "latency_p95_ms": 3500,
    "latency_p99_ms": 5000,
    "error_rate": 0.02
  },
  "performance": {
    "run_duration_p50_ms": 5000,
    "run_duration_p95_ms": 15000,
    "run_duration_p99_ms": 30000,
    "throughput_runs_per_hour": 42.5,
    "throughput_steps_per_hour": 250.0
  },
  "budgets": {
    "runs_with_budget": 200,
    "budget_exceeded_total": 5,
    "avg_cost_per_run_cents": 15.5,
    "avg_llm_calls_per_run": 3.2
  },
  ...
}
```

---

**Status:** ✅ **Production Ready**

