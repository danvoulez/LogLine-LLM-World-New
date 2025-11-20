import { CoreMessage } from 'ai';

/**
 * Mock LLM responses for testing
 */
export class MockLLM {
  /**
   * Create a mock LLM text generation response
   */
  static createMockTextResponse(text: string, toolCalls?: any[]) {
    return {
      text,
      toolCalls: toolCalls || [],
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      response: {
        id: 'mock-response-id',
        model: 'gpt-4o',
        object: 'chat.completion',
        created: Date.now(),
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: text,
            },
            finish_reason: 'stop',
          },
        ],
      },
    };
  }

  /**
   * Create a mock LLM streaming response
   */
  static createMockStreamResponse(text: string) {
    const chunks = text.split(' ').map((word, index) => ({
      id: `chunk-${index}`,
      choices: [
        {
          delta: { content: word + ' ' },
          index: 0,
        },
      ],
    }));

    return {
      textStream: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
      fullStream: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
      text: text,
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  }

  /**
   * Create a mock LLM error response
   */
  static createMockErrorResponse(errorMessage: string) {
    const error = new Error(errorMessage);
    (error as any).status = 500;
    (error as any).response = {
      status: 500,
      data: {
        error: {
          message: errorMessage,
          type: 'server_error',
        },
      },
    };
    return error;
  }

  /**
   * Create a mock rate limit error
   */
  static createMockRateLimitError() {
    const error = new Error('Rate limit exceeded');
    (error as any).status = 429;
    (error as any).response = {
      status: 429,
      headers: {
        'retry-after': '60',
      },
    };
    return error;
  }

  /**
   * Create a mock timeout error
   */
  static createMockTimeoutError() {
    const error = new Error('Request timeout');
    (error as any).code = 'ETIMEDOUT';
    (error as any).timeout = true;
    return error;
  }
}

