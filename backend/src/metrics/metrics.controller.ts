import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get()
  async getMetrics(
    @Query('format') format?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('enhanced') enhanced?: string,
  ) {
    const useEnhanced = enhanced === 'true' || enhanced === '1' || enhanced === undefined; // Default to enhanced

    if (format === 'prometheus') {
      return this.metricsService.getPrometheusMetrics(tenantId, useEnhanced);
    }

    // Enhanced metrics (recommended) - includes percentiles, throughput, granular breakdowns
    // Based on best practices from LangSmith, OpenAI Assistants API, and Prometheus
    if (useEnhanced) {
      return this.metricsService.getEnhancedMetricsSnapshot(tenantId);
    }

    // Legacy JSON format (for backward compatibility)
    return this.metricsService.getMetricsSnapshot(tenantId);
  }
}

