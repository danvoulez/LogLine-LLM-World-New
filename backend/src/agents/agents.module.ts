import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentsController } from './agents.controller';
import { SetupDefaultAgentsService } from './setup-default-agents.service';
import { ContextSummarizerService } from './context-summarizer.service';
import { Tool } from '../tools/entities/tool.entity';
import { Event } from '../runs/entities/event.entity';
import { Run } from '../runs/entities/run.entity';
import { Step } from '../runs/entities/step.entity';
import { ToolsModule } from '../tools/tools.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Tool, Event, Run, Step]),
    ToolsModule,
    LlmModule,
  ],
  controllers: [AgentsController],
  providers: [AgentRuntimeService, SetupDefaultAgentsService, ContextSummarizerService],
  exports: [AgentRuntimeService, ContextSummarizerService],
})
export class AgentsModule {}

