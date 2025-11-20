import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): { message: string; version: string; api: string } {
    return {
      message: 'LogLine LLM World API',
      version: '1.0.0',
      api: '/api/v1',
    };
  }

  @Get('healthz')
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    database: string;
    uptime: number;
  }> {
    const startTime = process.uptime();
    let dbStatus = 'disconnected';

    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'connected';
      }
    } catch (error) {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: Math.floor(startTime),
    };
  }
}
