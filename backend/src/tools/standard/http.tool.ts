import { Injectable } from '@nestjs/common';
import { ToolHandler, ToolContext } from '../tool-runtime.service';

@Injectable()
export class HttpTool {
  getDefinition() {
    return {
      id: 'http_request',
      name: 'HTTP Request',
      description: 'Make generic HTTP requests (GET, POST, PUT, DELETE, PATCH).',
      risk_level: 'high',
      side_effects: ['external_api_call'],
      input_schema: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          url: { type: 'string', format: 'uri' },
          headers: { type: 'object', additionalProperties: { type: 'string' } },
          body: { type: 'object', description: 'JSON body for the request' },
        },
        required: ['method', 'url'],
      },
      handler_type: 'builtin',
      handler_config: { handler: 'http_request' },
    };
  }

  handler: ToolHandler = async (input: any, ctx: ToolContext) => {
    const { method, url, headers = {}, body } = input;

    // In a real scenario, we would use Policy Engine to whitelist domains here.
    // For now, we rely on the 'risk_level: high' requiring explicit policy permission.

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseText = await response.text();
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
      };
    } catch (error) {
      return {
        error: `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  };
}

