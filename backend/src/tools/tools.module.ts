import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './entities/tool.entity';
import { ToolRuntimeService } from './tool-runtime.service';
import { ToolsController } from './tools.controller';
import { NaturalLanguageDbTool } from './natural-language-db.tool';
import { Event } from '../runs/entities/event.entity';
import { SchemaValidatorService } from '../common/validators/schema-validator.service';
import { LlmModule } from '../llm/llm.module';
import { RunsModule } from '../runs/runs.module';
import { AppsModule } from '../apps/apps.module';
import { PoliciesModule } from '../policies/policies.module';
import { MemoryModule } from '../memory/memory.module';
import { MemoryTool } from './memory.tool';
import { RegistryModule } from '../registry/registry.module';
import { HttpTool } from './standard/http.tool';
import { GithubTool } from './standard/github.tool';
import { MathTool } from './standard/math.tool';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Event]),
    LlmModule,
    forwardRef(() => RunsModule),
    forwardRef(() => AppsModule), // Circular dependency
    PoliciesModule, // Import PoliciesModule to access PolicyEngineV0Service
    MemoryModule, // Import MemoryModule to access MemoryService
    RegistryModule, // Import RegistryModule to access RegistryTool
  ],
  controllers: [ToolsController],
  providers: [
    ToolRuntimeService,
    NaturalLanguageDbTool,
    MemoryTool,
    SchemaValidatorService,
    HttpTool,
    GithubTool,
    MathTool,
  ],
  exports: [ToolRuntimeService],
})
export class ToolsModule {}
