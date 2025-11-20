import { Injectable, OnModuleInit } from '@nestjs/common';
import { TdlnTService } from './tdln-t.service';
import { ToolRuntimeService, ToolContext } from '../tools/tool-runtime.service';

/**
 * TDLN-T Tool: Exposes TDLN-T operations as a tool for agents
 * 
 * This allows agents to use deterministic translation when appropriate,
 * saving LLM costs for simple translation tasks.
 */
@Injectable()
export class TdlnTTool implements OnModuleInit {
  constructor(
    private tdlnTService: TdlnTService,
    private toolRuntime: ToolRuntimeService,
  ) {}

  onModuleInit() {
    this.registerTools();
  }

  private registerTools(): void {
    // Register translate tool
    this.toolRuntime.registerTool('tdln_t.translate', async (input: any, context: ToolContext) => {
      const sourceGrammar = this.getGrammarId(input.source_language || 'en_us');
      const targetGrammar = this.getGrammarId(input.target_language || 'pt_br');

      const result = await this.tdlnTService.translate(
        input.text,
        sourceGrammar,
        targetGrammar,
        input.include_trace || false,
      );

      return {
        original: result.original,
        translated: result.projected || result.original,
        method: 'tdln-t',
        cost: 0,
        trace: result.trace,
      };
    });

    // Register refract tool (for pre-processing)
    this.toolRuntime.registerTool('tdln_t.refract', async (input: any, context: ToolContext) => {
      const refracted = await this.tdlnTService.refract(
        input.text,
        input.grammar || 'grammar_en_us_strict',
      );

      return {
        text: input.text,
        refracted,
        components: refracted.map((t) => ({
          frequency: t.frequency,
          value: t.value,
          phase: t.phase,
        })),
      };
    });
  }

  private getGrammarId(languageCode: string): string {
    const mapping: Record<string, string> = {
      en_us: 'grammar_en_us_strict',
      en: 'grammar_en_us_strict',
      pt_br: 'grammar_pt_br_strict',
      pt: 'grammar_pt_br_strict',
    };

    return mapping[languageCode.toLowerCase()] || 'grammar_en_us_strict';
  }
}

