import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { CoreMessage, Tool } from 'ai';

export interface LlmConfig {
  provider: string; // 'openai', 'anthropic', 'google'
  model: string; // 'gpt-4o', 'claude-3-5-sonnet', etc.
  temperature?: number;
  maxTokens?: number;
}

@Injectable()
export class LlmRouterService {
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
  ) {
    const provider = this.getProvider(config.provider);
    const model = provider(config.model);

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
  }

  async streamText(
    prompt: string | CoreMessage[],
    config: LlmConfig,
    tools?: Record<string, Tool>,
  ) {
    const provider = this.getProvider(config.provider);
    const model = provider(config.model);

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
  }
}

