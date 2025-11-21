import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentsController } from './agents.controller';
import { SetupDefaultAgentsService } from './setup-default-agents.service';
import { ContextSummarizerService } from './context-summarizer.service';
import { AtomicEventConverterService } from './atomic-event-converter.service';
import { Tool } from '../tools/entities/tool.entity';
import { Event } from '../runs/entities/event.entity';
import { Run } from '../runs/entities/run.entity';
import { Step } from '../runs/entities/step.entity';
import { ToolsModule } from '../tools/tools.module';
import { LlmModule } from '../llm/llm.module';
import { TdlnTModule } from '../tdln-t/tdln-t.module';
import { MemoryModule } from '../memory/memory.module';
import { AgentInputValidatorService } from '../common/validators/agent-input-validator.service';
import { AtomicValidatorService } from './validators/atomic-validator.service';
import { RunsModule } from '../runs/runs.module';
import { PoliciesModule } from '../policies/policies.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Tool, Event, Run, Step]),
    ToolsModule,
    LlmModule,
    TdlnTModule,
    MemoryModule, // Memory & RAG for agent context
    forwardRef(() => RunsModule), // Import to access BudgetTrackerService
    PoliciesModule, // Import to access PolicyEngineV1Service
    RegistryModule, // Import to access ContractsService
  ],
  controllers: [AgentsController],
  providers: [
    AgentRuntimeService,
    SetupDefaultAgentsService,
    ContextSummarizerService,
    AtomicEventConverterService,
    AgentInputValidatorService,
    AtomicValidatorService,
  ],
  exports: [AgentRuntimeService, ContextSummarizerService, AtomicEventConverterService],
})
export class AgentsModule {}

