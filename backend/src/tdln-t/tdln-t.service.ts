import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  RefractedToken,
  Grammar,
  Dictionary,
  BasisMapping,
  TranslationResult,
  TranslationTrace,
  PatternRule,
} from './interfaces/tdln-t.interfaces';

/**
 * TDLN-T Service: Natural Language → JSON✯Atomic Structuring
 * 
 * Primary Purpose: Structure ANY natural language into JSON✯Atomic format
 * for better LLM understanding. Language doesn't matter - structure is universal.
 * 
 * Three Operations:
 * 1. Refract (Φ): Break text into semantic components (frequency, value, phase)
 * 2. Transmute (T): Transform using dictionary + syntax rules (optional, for translation)
 * 3. Project (ρ): Reconstruct text (optional, for translation)
 * 
 * Philosophy: 
 * - Primary: Structure natural language → JSON✯Atomic (any language)
 * - Secondary: Translate between languages (deterministic, cost savings)
 * - LLMs receive structured data, not confusing raw text
 * 
 * CURRENT LIMITATIONS (v1):
 * ===========================
 * 
 * 1. Deterministic Translation:
 *    - Heuristic-based detection of "deterministic tasks" (simple patterns)
 *    - Does NOT guarantee 100% determinism for all inputs
 *    - Complex sentences, idioms, context-dependent phrases may require LLM fallback
 *    - Heuristics are incomplete and will be expanded over time
 * 
 * 2. Refraction Quality:
 *    - Simple tokenization (word-level, not semantic)
 *    - Frequency identification is pattern-based, not NLP-powered
 *    - May not capture complex semantic relationships
 * 
 * 3. Grammar Support:
 *    - Currently limited to English (grammar_en_us_strict)
 *    - Other languages require grammar definitions
 * 
 * 4. Dictionary Coverage:
 *    - Limited dictionary mappings
 *    - Missing entries fall back to identity mapping
 * 
 * RECOMMENDATIONS:
 * ================
 * - Use TDLN-T for: Simple, repetitive tasks, structured data extraction
 * - Use LLM for: Complex reasoning, context-dependent translation, creative tasks
 * - Always validate TDLN-T output for critical operations
 * 
 * FUTURE IMPROVEMENTS:
 * ====================
 * - Enhanced heuristics for deterministic task detection
 * - NLP-powered semantic analysis for refraction
 * - Expanded grammar and dictionary support
 * - Confidence scoring for deterministic vs LLM decision
 */
@Injectable()
export class TdlnTService {
  private readonly logger = new Logger(TdlnTService.name);
  private grammars: Map<string, Grammar> = new Map();
  private dictionaries: Map<string, Dictionary> = new Map();
  private basisMappings: Map<string, BasisMapping> = new Map();

  constructor() {
    this.loadGrammars();
    this.loadDictionaries();
    this.loadBasisMappings();
  }

  /**
   * Operation 1: Refract (Φ) - Primary Use Case
   * Break ANY natural language into semantic components: (frequency, value, phase)
   * 
   * This is the core value: Structure natural language → JSON✯Atomic
   * Works for any language - structure is universal, language is in `value`
   */
  async refract(text: string, grammarId: string = 'grammar_en_us_strict'): Promise<RefractedToken[]> {
    const grammar = this.getGrammar(grammarId);
    if (!grammar) {
      throw new Error(`Grammar ${grammarId} not found`);
    }

    const tokens: RefractedToken[] = [];
    let phase = 0;
    let currentIndex = 0;

    // Simple tokenization (can be enhanced with proper NLP)
    const words = text.match(/\S+|\s+/g) || [];

    for (const word of words) {
      const frequency = this.identifyFrequency(word, grammar);
      tokens.push({
        frequency,
        value: word,
        phase,
      });
      phase++;
      currentIndex += word.length;
    }

    return tokens;
  }

  /**
   * Operation 2: Transmute (T)
   * Transform refracted tokens using dictionary + syntax rules
   */
  async transmute(
    refracted: RefractedToken[],
    sourceGrammarId: string,
    targetGrammarId: string,
  ): Promise<RefractedToken[]> {
    const sourceGrammar = this.getGrammar(sourceGrammarId);
    const targetGrammar = this.getGrammar(targetGrammarId);
    const dictionary = this.getDictionary(sourceGrammarId, targetGrammarId);
    const basisMapping = this.getBasisMapping(sourceGrammarId, targetGrammarId);

    if (!sourceGrammar || !targetGrammar) {
      throw new Error('Source or target grammar not found');
    }

    // Step 1: Apply lexical mapping (dictionary lookup)
    const lexicallyMapped = refracted.map((token) => {
      const mapping = basisMapping?.map.find((m) => m.sb === token.frequency);
      
      if (mapping?.action === 'identity' || this.isPreserved(token.frequency, sourceGrammar)) {
        // Preserve as-is (F_NET, F_CODE, F_VOID, etc.)
        return { ...token };
      }

      if (mapping?.action === 'dictionary_lookup' && dictionary) {
        // Look up in dictionary
        const dictRule = dictionary.rules.find((r) => r.in.toLowerCase() === token.value.toLowerCase());
        if (dictRule) {
          return {
            ...token,
            value: dictRule.out,
            frequency: mapping.tb || token.frequency,
          };
        }
      }

      // No mapping found, preserve original
      return { ...token };
    });

    // Step 2: Apply syntax topology (phase swapping)
    const syntaxApplied = this.applySyntaxTopology(lexicallyMapped, sourceGrammar, targetGrammar);

    return syntaxApplied;
  }

  /**
   * Operation 3: Project (ρ)
   * Reconstruct text from refracted tokens
   */
  async project(refracted: RefractedToken[]): Promise<string> {
    // Sort by phase
    const sorted = [...refracted].sort((a, b) => a.phase - b.phase);
    
    // Concatenate values
    return sorted.map((token) => token.value).join('');
  }

  /**
   * Refract to JSON✯Atomic format (Primary Use Case)
   * Structure natural language into atomic format for LLM consumption
   * 
   * This is what we should use for ALL natural language before sending to LLMs
   */
  async refractToAtomic(
    text: string,
    language?: string, // Optional: auto-detect or specify
  ): Promise<{
    type: string;
    schema_id: string;
    body: {
      original_text: string;
      language?: string;
      tokens: RefractedToken[];
    };
    meta: {
      header: {
        who: { id: string; role: string };
        did: string;
        this: { id: string };
        when: { ts: string };
        status: 'APPROVE';
      };
      trace_id?: string;
      context_id?: string;
      version: string;
    };
    hash: string;
  }> {
    // Auto-detect grammar based on language or default to English
    const grammarId = this.detectGrammar(language) || 'grammar_en_us_strict';
    
    // Refract text into semantic components
    const tokens = await this.refract(text, grammarId);
    
    // Build JSON✯Atomic format
    const atomic = {
      type: 'text.refracted@1.0.0',
      schema_id: 'text.refracted@1.0.0',
      body: {
        original_text: text,
        language: language || 'auto',
        tokens,
      },
      meta: {
        header: {
          who: { id: 'tdln-t', role: 'structuring' },
          did: 'refract_natural_language',
          this: { id: `refract-${Date.now()}` },
          when: { ts: new Date().toISOString() },
          status: 'APPROVE' as const,
        },
        version: '1.0.0',
      },
      hash: this.computeHashForAtomic(tokens),
    };

    return atomic;
  }

  /**
   * Full translation pipeline: Refract → Transmute → Project (Secondary Use Case)
   * Use for deterministic translation between languages
   */
  async translate(
    text: string,
    sourceGrammarId: string = 'grammar_en_us_strict',
    targetGrammarId: string = 'grammar_pt_br_strict',
    includeTrace: boolean = false,
  ): Promise<TranslationResult> {
    const trace: TranslationTrace = {
      refract_stage: {
        tokens: [],
        grammar_used: sourceGrammarId,
      },
    };

    // Step 1: Refract
    const refracted = await this.refract(text, sourceGrammarId);
    trace.refract_stage.tokens = refracted;

    // Step 2: Transmute
    const transmuted = await this.transmute(refracted, sourceGrammarId, targetGrammarId);
    trace.transmute_stage = {
      lexical_map_applied: this.getLexicalMapApplied(refracted, transmuted),
      intermediate_state: transmuted,
    };

    // Step 3: Project
    const projected = await this.project(transmuted);
    trace.project_stage = {
      sorted_by_phase: [...transmuted].sort((a, b) => a.phase - b.phase),
      concatenated: projected,
    };

    return {
      original: text,
      refracted,
      transmuted,
      projected,
      trace: includeTrace ? trace : undefined,
    };
  }

  /**
   * Check if a task is deterministic (can use TDLN-T instead of LLM)
   * 
   * Expanded heuristics:
   * - Simple translation requests
   * - Text transformations (uppercase, lowercase, trim, reverse)
   * - Format conversions (date, number formatting)
   * - Dictionary lookups
   * - Code/identifier preservation tasks
   */
  isDeterministicTask(input: any): boolean {
    if (typeof input === 'string') {
      const normalized = input.trim().toLowerCase();

      // Translation requests
      if (normalized.match(/^(translate|convert|transform)\s+/)) {
        return true;
      }

      // Text transformations
      if (normalized.match(/^(uppercase|lowercase|capitalize|trim|reverse|replace)\s+/)) {
        return true;
      }

      // Format conversions
      if (normalized.match(/^(format|parse)\s+(date|number|currency|time)/)) {
        return true;
      }

      // Dictionary lookups
      if (normalized.match(/^(lookup|find|get)\s+(word|term|definition)/)) {
        return true;
      }

      // Code/identifier preservation (refract to atomic)
      if (normalized.match(/^(refract|structure|parse)\s+(code|identifier|variable)/)) {
        return true;
      }

      // Simple text operations
      if (normalized.match(/^(count|length|split|join)\s+(words|characters|lines)/)) {
        return true;
      }
    }

    // Object with deterministic operation type
    if (typeof input === 'object' && input !== null) {
      const op = (input as any).operation || (input as any).op;
      if (typeof op === 'string') {
        const deterministicOps = [
          'translate',
          'refract',
          'transmute',
          'project',
          'format',
          'parse',
          'transform',
          'lookup',
        ];
        if (deterministicOps.includes(op.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle deterministic task using TDLN-T (no LLM needed)
   */
  async handleDeterministicTask(input: any): Promise<any> {
    if (typeof input === 'string') {
      // Simple translation
      if (input.match(/^translate\s+(.+?)\s+(?:from|to)\s+(\w+)/i)) {
        const match = input.match(/^translate\s+(.+?)\s+(?:from|to)\s+(\w+)/i);
        if (match) {
          const text = match[1];
          const targetLang = match[2].toLowerCase();
          const sourceGrammar = 'grammar_en_us_strict';
          const targetGrammar = targetLang === 'pt' || targetLang === 'pt-br' 
            ? 'grammar_pt_br_strict' 
            : 'grammar_en_us_strict';
          
          const result = await this.translate(text, sourceGrammar, targetGrammar);
          return {
            text: result.projected || result.original,
            method: 'tdln-t',
            cost: 0,
          };
        }
      }
    }

    throw new Error('Task not deterministic or not supported');
  }

  // Private helper methods

  private identifyFrequency(word: string, grammar: Grammar): string {
    // Check each frequency definition
    for (const freq of grammar.frequencies) {
      if (freq.regex) {
        const regex = new RegExp(freq.regex);
        if (regex.test(word)) {
          return freq.id;
        }
      }
    }

    // Default to F_KEY if no match
    return 'F_KEY';
  }

  private isPreserved(frequency: string, grammar: Grammar): boolean {
    const freqDef = grammar.frequencies.find((f) => f.id === frequency);
    return freqDef?.preserve === true;
  }

  private applySyntaxTopology(
    tokens: RefractedToken[],
    sourceGrammar: Grammar,
    targetGrammar: Grammar,
  ): RefractedToken[] {
    // Check for syntax patterns that need reordering
    for (let i = 0; i < tokens.length - 2; i++) {
      const window = tokens.slice(i, i + 3);
      const pattern = window.map((t) => t.frequency);

      // Check source grammar patterns
      for (const rule of sourceGrammar.patterns) {
        if (this.matchesPattern(pattern, rule.trigger_pattern)) {
          // Apply phase swap if needed
          if (rule.operation === 'phase_swap' && rule.target_order) {
            const reordered = this.swapPhases(window, rule.target_order);
            // Replace in tokens array
            for (let j = 0; j < reordered.length; j++) {
              tokens[i + j] = reordered[j];
            }
            break;
          }
        }
      }
    }

    return tokens;
  }

  private matchesPattern(actual: string[], expected: string[]): boolean {
    if (actual.length !== expected.length) return false;
    return actual.every((freq, i) => freq === expected[i]);
  }

  private swapPhases(tokens: RefractedToken[], targetOrder: number[]): RefractedToken[] {
    const reordered: RefractedToken[] = [];
    for (const targetIndex of targetOrder) {
      reordered.push({ ...tokens[targetIndex] });
    }
    return reordered;
  }

  private getLexicalMapApplied(
    original: RefractedToken[],
    transmuted: RefractedToken[],
  ): Array<{ from: string; to: string }> {
    const applied: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < original.length; i++) {
      if (original[i].value !== transmuted[i].value) {
        applied.push({
          from: original[i].value,
          to: transmuted[i].value,
        });
      }
    }
    return applied;
  }

  private getGrammar(grammarId: string): Grammar | undefined {
    return this.grammars.get(grammarId);
  }

  private getDictionary(sourceGrammarId: string, targetGrammarId: string): Dictionary | undefined {
    const key = `${sourceGrammarId}_to_${targetGrammarId}`;
    return this.dictionaries.get(key);
  }

  private getBasisMapping(sourceGrammarId: string, targetGrammarId: string): BasisMapping | undefined {
    const key = `${sourceGrammarId}_to_${targetGrammarId}`;
    return this.basisMappings.get(key);
  }

  private loadGrammars(): void {
    try {
      const enUsGrammarPath = path.join(__dirname, 'grammars', 'grammar-en-us-strict.json');
      const ptBrGrammarPath = path.join(__dirname, 'grammars', 'grammar-pt-br-strict.json');

      if (fs.existsSync(enUsGrammarPath)) {
        const enUsGrammar: Grammar = JSON.parse(fs.readFileSync(enUsGrammarPath, 'utf-8'));
        this.grammars.set('grammar_en_us_strict', enUsGrammar);
      }

      if (fs.existsSync(ptBrGrammarPath)) {
        const ptBrGrammar: Grammar = JSON.parse(fs.readFileSync(ptBrGrammarPath, 'utf-8'));
        this.grammars.set('grammar_pt_br_strict', ptBrGrammar);
      }

      this.logger.log(`Loaded ${this.grammars.size} grammars`);
    } catch (error) {
      this.logger.error('Failed to load grammars:', error);
    }
  }

  private loadDictionaries(): void {
    try {
      const dictPath = path.join(__dirname, 'dictionaries', 'en-us-to-pt-br.json');
      if (fs.existsSync(dictPath)) {
        const dictionary: Dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
        this.dictionaries.set('grammar_en_us_strict_to_grammar_pt_br_strict', dictionary);
      }

      this.logger.log(`Loaded ${this.dictionaries.size} dictionaries`);
    } catch (error) {
      this.logger.error('Failed to load dictionaries:', error);
    }
  }

  private loadBasisMappings(): void {
    // Create default basis mapping
    const defaultMapping: BasisMapping = {
      description: 'Default basis mapping between English and Portuguese',
      map: [
        { sb: 'F_NET', tb: 'F_NET', action: 'identity' },
        { sb: 'F_CODE', tb: 'F_CODE', action: 'identity' },
        { sb: 'F_KEY', tb: 'F_KEY', action: 'dictionary_lookup' },
        { sb: 'F_ADJ', tb: 'F_ADJ', action: 'dictionary_lookup' },
        { sb: 'F_NOUN', tb: 'F_NOUN', action: 'dictionary_lookup' },
        { sb: 'F_META', tb: 'F_META', action: 'identity' },
        { sb: 'F_VOID', tb: 'F_VOID', action: 'identity' },
        { sb: 'F_TEMP', tb: 'F_TEMP', action: 'reformat', format: 'ISO8601' },
        { sb: 'F_NUM', tb: 'F_NUM', action: 'identity' },
      ],
    };

    this.basisMappings.set('grammar_en_us_strict_to_grammar_pt_br_strict', defaultMapping);
    this.logger.log(`Loaded ${this.basisMappings.size} basis mappings`);
  }

  getAvailableGrammars(): string[] {
    return Array.from(this.grammars.keys());
  }

  /**
   * Detect grammar based on language code
   */
  private detectGrammar(language?: string): string | undefined {
    if (!language) return undefined;

    const mapping: Record<string, string> = {
      en: 'grammar_en_us_strict',
      'en-us': 'grammar_en_us_strict',
      'en_us': 'grammar_en_us_strict',
      pt: 'grammar_pt_br_strict',
      'pt-br': 'grammar_pt_br_strict',
      'pt_br': 'grammar_pt_br_strict',
      // Add more languages as grammars are added
    };

    return mapping[language.toLowerCase()];
  }

  /**
   * Compute hash for atomic format
   */
  private computeHashForAtomic(tokens: RefractedToken[]): string {
    const content = JSON.stringify(tokens);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

