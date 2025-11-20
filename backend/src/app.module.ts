import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkflowsModule } from './workflows/workflows.module';
import { RunsModule } from './runs/runs.module';
import { Workflow } from './workflows/entities/workflow.entity';
import { Run } from './runs/entities/run.entity';
import { Step } from './runs/entities/step.entity';
import { Event } from './runs/entities/event.entity';
import { SetupPgVectorService } from './database/setup-pgvector.service';
import { DatabaseController } from './database/database.controller';

// Parse POSTGRES_URL if available (Vercel Postgres format)
function getDatabaseConfig() {
  // If POSTGRES_URL is provided (Vercel Postgres), use it directly
  // Vercel Postgres automatically provides POSTGRES_URL in format:
  // postgresql://username:password@host:port/database
  if (process.env.POSTGRES_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.POSTGRES_URL,
      entities: [Workflow, Run, Step, Event],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      // Vercel Postgres requires SSL in production
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : undefined,
      // Connection pooling for serverless
      extra: {
        max: 10, // Maximum number of connections in pool
        connectionTimeoutMillis: 5000, // Increased timeout for serverless
        idleTimeoutMillis: 30000,
      },
      // Don't fail on connection errors during startup
      retryAttempts: 3,
      retryDelay: 3000,
      // Enable pgvector extension on connection
      migrations: ['dist/database/migrations/*.js'],
      migrationsRun: false, // We'll run migrations manually or via API
    };
  }

  // Otherwise, use individual connection parameters (for local development)
  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'logline',
    entities: [Workflow, Run, Step, Event],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => getDatabaseConfig(),
      // Don't fail app startup if DB connection fails
      // Connection will be established on first use
    }),
    WorkflowsModule,
    RunsModule,
  ],
  controllers: [AppController, DatabaseController],
  providers: [AppService, SetupPgVectorService],
})
export class AppModule {}
