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

    // Wait a bit for database connection to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Initialize connection if not already initialized
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // Check if extension already exists
      const checkResult = await this.dataSource.query(
        "SELECT * FROM pg_extension WHERE extname = 'vector';"
      );

      if (checkResult.length === 0) {
        await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector;');
        console.log('✅ pgvector extension enabled');
      } else {
        console.log('✅ pgvector extension already enabled');
      }
    } catch (error) {
      // Extension might already exist, or connection not ready
      // This is fine - it will be enabled manually if needed
      console.log('ℹ️  pgvector extension check:', error.message);
      // Don't throw - allow app to continue
    }
  }
}

