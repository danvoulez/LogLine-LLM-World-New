import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './entities/tool.entity';
import { ToolRuntimeService } from './tool-runtime.service';
import { NaturalLanguageDbTool } from './natural-language-db.tool';
import { Event } from '../runs/entities/event.entity';
import { LlmModule } from '../llm/llm.module';
import { RunsModule } from '../runs/runs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Event]),
    LlmModule,
    RunsModule,
  ],
  providers: [ToolRuntimeService, NaturalLanguageDbTool],
  exports: [ToolRuntimeService],
})
export class ToolsModule {}

