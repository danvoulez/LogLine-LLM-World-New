import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SetupPgVectorService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    // Enable pgvector extension on app startup
    // Only run if POSTGRES_URL is available (Vercel Postgres)
    if (!process.env.POSTGRES_URL) {
      console.log('ℹ️  POSTGRES_URL not available, skipping pgvector setup');
      return;
    }

    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✅ pgvector extension enabled');
    } catch (error) {
      // Extension might already exist, or we don't have permission
      // This is fine - it will be enabled manually if needed
      console.log('ℹ️  pgvector extension check:', error.message);
    }
  }
}

