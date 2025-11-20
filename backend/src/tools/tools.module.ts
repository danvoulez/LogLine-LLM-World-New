import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './entities/tool.entity';
import { ToolRuntimeService } from './tool-runtime.service';
import { ToolsController } from './tools.controller';
import { NaturalLanguageDbTool } from './natural-language-db.tool';
import { Event } from '../runs/entities/event.entity';
import { SchemaValidatorService } from '../common/validators/schema-validator.service';
import { LlmModule } from '../llm/llm.module';
import { RunsModule } from '../runs/runs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Event]),
    LlmModule,
    RunsModule,
  ],
  controllers: [ToolsController],
  providers: [ToolRuntimeService, NaturalLanguageDbTool, SchemaValidatorService],
  exports: [ToolRuntimeService],
})
export class ToolsModule {}

