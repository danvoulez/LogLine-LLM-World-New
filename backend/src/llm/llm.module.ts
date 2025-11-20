import { Module } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';

@Module({
  providers: [LlmRouterService],
  exports: [LlmRouterService],
})
export class LlmModule {}

