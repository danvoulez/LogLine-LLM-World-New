import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter'; // NEW
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkflowsModule } from './workflows/workflows.module';
import { RunsModule } from './runs/runs.module';
import { Workflow } from './workflows/entities/workflow.entity';
import { Run } from './runs/entities/run.entity';
import { Step } from './runs/entities/step.entity';
import { Event } from './runs/entities/event.entity';
import { Tool } from './tools/entities/tool.entity';
import { Agent } from './agents/entities/agent.entity';
import { App } from './apps/entities/app.entity';
import { AppScope } from './apps/entities/app-scope.entity';
import { AppWorkflow } from './apps/entities/app-workflow.entity';
import { AppAction } from './apps/entities/app-action.entity';
import { SetupPgVectorService } from './database/setup-pgvector.service';
import { DatabaseController } from './database/database.controller';
import { LlmModule } from './llm/llm.module';
import { ToolsModule } from './tools/tools.module';
import { AgentsModule } from './agents/agents.module';
import { AppsModule } from './apps/apps.module';
import { FilesModule } from './files/files.module';
import { TdlnTModule } from './tdln-t/tdln-t.module';
import { MemoryModule } from './memory/memory.module';
import { PoliciesModule } from './policies/policies.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { MetricsModule } from './metrics/metrics.module';
import { AlertsModule } from './alerts/alerts.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { CronModule } from './cron/cron.module';
import { RegistryModule } from './registry/registry.module';
import { File } from './files/entities/file.entity';
import { MemoryItem } from './memory/entities/memory-item.entity';
import { Resource } from './memory/entities/resource.entity';
import { Policy } from './policies/entities/policy.entity';
import { User } from './auth/entities/user.entity';
import { Session } from './auth/entities/session.entity';
import { ApiKey } from './auth/entities/api-key.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { AlertConfig } from './alerts/entities/alert-config.entity';
import { AlertHistory } from './alerts/entities/alert-history.entity';
import { CorePerson } from './registry/people/entities/core-person.entity';
import { TenantPeopleRelationship } from './registry/people/entities/tenant-people-relationship.entity';
import { RegistryObject } from './registry/objects/entities/registry-object.entity';
import { RegistryObjectMovement } from './registry/objects/entities/registry-object-movement.entity';
import { AgentTrainingHistory } from './registry/agents/entities/agent-training-history.entity';
import { AgentEvaluation } from './registry/agents/entities/agent-evaluation.entity';
import { AgentExecutionLog } from './registry/agents/entities/agent-execution-log.entity';
import { RegistryIdea } from './registry/ideas/entities/registry-idea.entity';
import { RegistryIdeaVote } from './registry/ideas/entities/registry-idea-vote.entity';
import { RegistryContract } from './registry/contracts/entities/registry-contract.entity';
import { RegistryContractStateHistory } from './registry/contracts/entities/registry-contract-state-history.entity';
import { ContractTemplate } from './registry/contracts/entities/contract-template.entity';
import { RegistryRelationship } from './registry/relationships/entities/registry-relationship.entity';
import { DataSource } from 'typeorm';

// Parse POSTGRES_URL if available (Vercel Postgres format)
function getDatabaseConfig() {
  // If POSTGRES_URL is provided (Vercel Postgres), use it directly
  // Vercel Postgres automatically provides POSTGRES_URL in format:
  // postgresql://username:password@host:port/database
  if (process.env.POSTGRES_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.POSTGRES_URL,
      entities: [Workflow, Run, Step, Event, Tool, Agent, App, AppScope, AppWorkflow, AppAction, File, MemoryItem, Resource, Policy, User, Session, ApiKey, AuditLog, AlertConfig, AlertHistory, CorePerson, TenantPeopleRelationship, RegistryObject, RegistryObjectMovement, AgentTrainingHistory, AgentEvaluation, AgentExecutionLog, RegistryIdea, RegistryIdeaVote, RegistryContract, RegistryContractStateHistory, ContractTemplate, RegistryRelationship],
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
    entities: [Workflow, Run, Step, Event, Tool, Agent, App, AppScope, AppWorkflow, AppAction, File, MemoryItem, Resource, Policy, User, Session, ApiKey, AuditLog, AlertConfig, AlertHistory, CorePerson, TenantPeopleRelationship, RegistryObject, RegistryObjectMovement, AgentTrainingHistory, AgentEvaluation, AgentExecutionLog, RegistryIdea, RegistryIdeaVote, RegistryContract, RegistryContractStateHistory, ContractTemplate, RegistryRelationship],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };
}

@Module({
  imports: [
    // Rate limiting for API protection
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        return await getDatabaseConfig();
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Database configuration options are required');
        }
        const dataSource = await new DataSource(options).initialize();
        return dataSource;
      },
    }),
    WorkflowsModule,
    RunsModule,
    LlmModule,
    ToolsModule,
    AgentsModule,
    AppsModule,
    FilesModule,
    TdlnTModule, // TDLN-T deterministic translation
    MemoryModule,
    PoliciesModule, // Memory & RAG engine
    AuthModule, // Authentication & RBAC
    AuditModule, // Audit logging
    MetricsModule, // Metrics & monitoring
    AlertsModule, // Alerts system
    RateLimitingModule, // Enhanced rate limiting
    CronModule, // Scheduled tasks
    RegistryModule, // Universal Registry (People, Objects)
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController, DatabaseController],
  providers: [
    AppService,
    SetupPgVectorService,
    // Enable rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
      // Apply rate limiting to all routes (can be overridden with @SkipThrottle)
    },
    // Enable global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
