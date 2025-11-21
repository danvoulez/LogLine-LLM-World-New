import { Injectable } from '@nestjs/common';
import { ToolHandler, ToolContext } from '../tool-runtime.service';

@Injectable()
export class MathTool {
  getDefinition() {
    return {
      id: 'calculator',
      name: 'Calculator',
      description: 'Evaluate mathematical expressions safely.',
      risk_level: 'low',
      side_effects: [],
      input_schema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression to evaluate (e.g., "12 * (5 + 2)")' },
        },
        required: ['expression'],
      },
      handler_type: 'builtin',
      handler_config: { handler: 'calculator' },
    };
  }

  handler: ToolHandler = async (input: any, ctx: ToolContext) => {
    const { expression } = input;

    // Very basic and slightly unsafe eval replacement. 
    // In production, use 'mathjs' library to avoid arbitrary code execution.
    // For MVP, we strip anything that isn't a number or math operator.
    
    if (/[^0-9\.\+\-\*\/\(\)\s]/.test(expression)) {
      return { error: 'Invalid characters in expression. Only numbers and basic operators allowed.' };
    }

    try {
      // eslint-disable-next-line no-eval
      const result = eval(expression); 
      return { result };
    } catch (error) {
      return { error: 'Failed to evaluate expression' };
    }
  };
}

