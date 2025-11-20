import { Injectable, Logger } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { CoreMessage, Tool } from 'ai';
import { RetryUtil } from '../common/utils/retry.util';
import { AgentExecutionException } from '../common/exceptions/agent-execution.exception';

export interface LlmConfig {
  provider: string; // 'openai', 'anthropic', 'google'
  model: string; // 'gpt-4o', 'claude-3-5-sonnet', etc.
  temperature?: number;
  maxTokens?: number;
}

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  private getProvider(provider: string) {
    switch (provider) {
      case 'openai':
        return openai;
      case 'anthropic':
        return anthropic;
      case 'google':
        return google;
      default:
        return openai;
    }
  }

  async generateText(
    prompt: string | CoreMessage[],
    config: LlmConfig,
    tools?: Record<string, Tool>,
    context?: { agentId?: string; runId?: string; stepId?: string },
  ) {
    const provider = this.getProvider(config.provider);
    const model = provider(config.model);

    try {
      return await RetryUtil.retryWithBackoff(
        async () => {
          if (typeof prompt === 'string') {
            return generateText({
              model,
              prompt,
              temperature: config.temperature,
              ...(config.maxTokens && { maxTokens: config.maxTokens }),
              ...(tools && { tools }),
            });
          } else {
            return generateText({
              model,
              messages: prompt,
              temperature: config.temperature,
              ...(config.maxTokens && { maxTokens: config.maxTokens }),
              ...(tools && { tools }),
            });
          }
        },
        3, // max attempts
        1000, // base delay
        this.logger,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown LLM error';
      this.logger.error(
        `LLM generation failed for provider ${config.provider}, model ${config.model}`,
        error instanceof Error ? error.stack : String(error),
        context,
      );

      throw new AgentExecutionException(
        context?.agentId || 'unknown',
        `LLM generation failed: ${errorMessage}`,
        error instanceof Error ? error : new Error(String(error)),
        context,
      );
    }
  }

  async streamText(
    prompt: string | CoreMessage[],
    config: LlmConfig,
    tools?: Record<string, Tool>,
    context?: { agentId?: string; runId?: string; stepId?: string },
  ) {
    const provider = this.getProvider(config.provider);
    const model = provider(config.model);

    try {
      // Streaming doesn't support retry easily, but we can catch and log errors
      if (typeof prompt === 'string') {
        return streamText({
          model,
          prompt,
          temperature: config.temperature,
          ...(config.maxTokens && { maxTokens: config.maxTokens }),
          ...(tools && { tools }),
        });
      } else {
        return streamText({
          model,
          messages: prompt,
          temperature: config.temperature,
          ...(config.maxTokens && { maxTokens: config.maxTokens }),
          ...(tools && { tools }),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown LLM error';
      this.logger.error(
        `LLM streaming failed for provider ${config.provider}, model ${config.model}`,
        error instanceof Error ? error.stack : String(error),
        context,
      );

      throw new AgentExecutionException(
        context?.agentId || 'unknown',
        `LLM streaming failed: ${errorMessage}`,
        error instanceof Error ? error : new Error(String(error)),
        context,
      );
    }
  }
}

