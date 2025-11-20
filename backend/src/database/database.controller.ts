import { Controller, Post, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('database')
export class DatabaseController {
  constructor(private dataSource: DataSource) {}

  @Post('enable-pgvector')
  async enablePgVector() {
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // Verify it's enabled
      const result = await this.dataSource.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector';"
      );

      return {
        success: true,
        message: 'pgvector extension enabled successfully',
        extension: result.length > 0 ? result[0] : null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to enable pgvector extension',
      };
    }
  }

  @Get('check-pgvector')
  async checkPgVector() {
    try {
      const result = await this.dataSource.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector';"
      );

      return {
        enabled: result.length > 0,
        extension: result.length > 0 ? result[0] : null,
      };
    } catch (error) {
      return {
        enabled: false,
        error: error.message,
      };
    }
  }
}

