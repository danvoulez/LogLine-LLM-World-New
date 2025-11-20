import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText, streamText, GenerateTextResult, StreamTextResult } from 'ai';
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
  ): Promise<GenerateTextResult> {
    const provider = this.getProvider(config.provider);
    const model = provider(config.model);

    return generateText({
      model,
      prompt: typeof prompt === 'string' ? prompt : prompt,
      messages: typeof prompt === 'string' ? undefined : prompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools: tools,
    });
  }

  async streamText(
    prompt: string | CoreMessage[],
    config: LlmConfig,
    tools?: Record<string, Tool>,
  ): Promise<StreamTextResult> {
    const provider = this.getProvider(config.provider);
    const model = provider(config.model);

    return streamText({
      model,
      prompt: typeof prompt === 'string' ? prompt : prompt,
      messages: typeof prompt === 'string' ? undefined : prompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools: tools,
    });
  }
}

