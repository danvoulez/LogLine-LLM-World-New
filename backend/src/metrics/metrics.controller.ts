import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Query('format') format?: string, @Query('tenant_id') tenantId?: string) {
    if (format === 'prometheus') {
      return this.metricsService.getPrometheusMetrics(tenantId);
    }

    // Default: JSON format
    return this.metricsService.getMetricsSnapshot(tenantId);
  }
}

