import { Injectable, Optional } from '@nestjs/common';
import { AtomicEventConverterService, AtomicContext } from './atomic-event-converter.service';
import { Step } from '../runs/entities/step.entity';
import { Event } from '../runs/entities/event.entity';
import { Run } from '../runs/entities/run.entity';

/**
 * Context Summarizer Service
 * 
 * Converts structured data (JSON, objects) into natural language summaries
 * that are easier for AI partners to understand and work with.
 * 
 * Philosophy: Speak the AI's language (natural language), not dump raw data.
 */
@Injectable()
export class ContextSummarizerService {
  constructor(private atomicConverter?: AtomicEventConverterService) {}
  /**
   * Summarize previous steps in natural language
   */
  summarizePreviousSteps(steps: Array<{ node_id: string; output?: any }>): string {
    if (!steps || steps.length === 0) {
      return 'This is the first step in the workflow.';
    }

    const summaries = steps.map((step, index) => {
      const stepNum = index + 1;
      const nodeName = step.node_id || 'unknown';
      const output = step.output;

      if (!output) {
        return `Step ${stepNum} (${nodeName}): Completed`;
      }

      // Try to extract meaningful information from output
      const summary = this.summarizeOutput(output);
      return `Step ${stepNum} (${nodeName}): ${summary}`;
    });

    return `Here's what we've accomplished so far:\n${summaries.join('\n')}`;
  }

  /**
   * Summarize workflow input in natural language
   */
  summarizeWorkflowInput(input: Record<string, any>): string {
    if (!input || Object.keys(input).length === 0) {
      return 'No specific input provided for this workflow.';
    }

    const items: string[] = [];
    for (const [key, value] of Object.entries(input)) {
      const description = this.describeValue(key, value);
      items.push(description);
    }

    return `The workflow was started with these inputs:\n${items.join('\n')}`;
  }

  /**
   * Summarize step output in natural language
   */
  summarizeStepOutput(output: any): string {
    if (!output) {
      return 'No output from this step.';
    }

    return this.summarizeOutput(output);
  }

  /**
   * Summarize any output value
   */
  private summarizeOutput(output: any): string {
    if (typeof output === 'string') {
      return output;
    }

    if (typeof output === 'number' || typeof output === 'boolean') {
      return String(output);
    }

    if (Array.isArray(output)) {
      if (output.length === 0) {
        return 'No items found.';
      }
      if (output.length === 1) {
        return `Found 1 item: ${this.describeValue('item', output[0])}`;
      }
      return `Found ${output.length} items. ${this.summarizeArray(output)}`;
    }

    if (typeof output === 'object' && output !== null) {
      // Try to extract meaningful information
      if (output.text) {
        return output.text;
      }
      if (output.message) {
        return output.message;
      }
      if (output.error) {
        return `Error: ${output.error}`;
      }
      if (output.status) {
        return `Status: ${output.status}`;
      }

      // Summarize object properties
      const props = Object.entries(output)
        .slice(0, 5) // Limit to first 5 properties
        .map(([key, value]) => {
          const desc = this.describeValue(key, value);
          return `  - ${desc}`;
        })
        .join('\n');

      if (Object.keys(output).length > 5) {
        return `Results:\n${props}\n  ... and ${Object.keys(output).length - 5} more properties`;
      }
      return `Results:\n${props}`;
    }

    return JSON.stringify(output);
  }

  /**
   * Summarize an array
   */
  private summarizeArray(arr: any[]): string {
    if (arr.length === 0) return '';
    if (arr.length <= 3) {
      return arr.map((item, i) => `Item ${i + 1}: ${this.summarizeOutput(item)}`).join('\n');
    }
    return `First few items: ${arr.slice(0, 3).map(item => this.summarizeOutput(item)).join(', ')} ... and ${arr.length - 3} more`;
  }

  /**
   * Describe a key-value pair in natural language
   */
  private describeValue(key: string, value: any): string {
    const keyName = this.humanizeKey(key);

    if (value === null || value === undefined) {
      return `${keyName}: not provided`;
    }

    if (typeof value === 'string') {
      return `${keyName}: "${value}"`;
    }

    if (typeof value === 'number') {
      return `${keyName}: ${value}`;
    }

    if (typeof value === 'boolean') {
      return `${keyName}: ${value ? 'yes' : 'no'}`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${keyName}: none`;
      }
      if (value.length === 1) {
        return `${keyName}: ${this.summarizeOutput(value[0])}`;
      }
      return `${keyName}: ${value.length} items`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return `${keyName}: empty object`;
      }
      if (keys.length <= 3) {
        const props = keys.map(k => `${k}: ${this.summarizeOutput(value[k])}`).join(', ');
        return `${keyName}: {${props}}`;
      }
      return `${keyName}: object with ${keys.length} properties`;
    }

    return `${keyName}: ${String(value)}`;
  }

  /**
   * Convert snake_case or camelCase to human-readable
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  /**
   * Build a conversational context message
   */
  buildConversationalContext(
    previousSteps: Array<{ node_id: string; output?: any }> = [],
    workflowInput?: Record<string, any>,
    currentTask?: string,
  ): string {
    const parts: string[] = [];

    if (previousSteps.length > 0) {
      parts.push(this.summarizePreviousSteps(previousSteps));
    }

    if (workflowInput && Object.keys(workflowInput).length > 0) {
      parts.push(this.summarizeWorkflowInput(workflowInput));
    }

    if (currentTask) {
      parts.push(`\nCurrent task: ${currentTask}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build conversational context with atomic format support
   * Combines atomic structure (for LLM understanding) with natural language (for dignity)
   */
  async buildConversationalContextWithAtomic(
    steps: Step[],
    events: Event[],
    run: Run,
    workflowInput?: Record<string, any>,
    currentTask?: string,
  ): Promise<string> {
    const parts: string[] = [];

    // Build atomic context if converter is available
    if (this.atomicConverter && steps.length > 0) {
      try {
        const atomicContext = await this.atomicConverter.buildAtomicContextChain(
          steps,
          events,
          run,
        );
        const atomicMessage = this.atomicConverter.formatAtomicContextForLLM(atomicContext);
        parts.push(atomicMessage);
      } catch (error) {
        // Fallback to natural language if atomic conversion fails
        // Note: Logger not available in this service, but error is caught and handled gracefully
        if (steps.length > 0) {
          const stepSummaries = steps.map((s) => ({
            node_id: s.node_id,
            output: s.output,
          }));
          parts.push(this.summarizePreviousSteps(stepSummaries));
        }
      }
    } else {
      // Fallback to natural language if atomic converter not available
      if (steps.length > 0) {
        const stepSummaries = steps.map((s) => ({
          node_id: s.node_id,
          output: s.output,
        }));
        parts.push(this.summarizePreviousSteps(stepSummaries));
      }
    }

    // Add workflow input summary
    if (workflowInput && Object.keys(workflowInput).length > 0) {
      parts.push(this.summarizeWorkflowInput(workflowInput));
    }

    // Add current task
    if (currentTask) {
      parts.push(`\nCurrent task: ${currentTask}`);
    }

    return parts.join('\n\n');
  }
}

