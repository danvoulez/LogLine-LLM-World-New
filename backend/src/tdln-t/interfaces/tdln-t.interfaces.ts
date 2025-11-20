/**
 * TDLN-T Protocol Interfaces
 * 
 * Based on TDLN-T: Deterministic Translation Protocol
 * Three operations: Refract (Φ), Transmute (T), Project (ρ)
 */

export interface RefractedToken {
  frequency: string; // Semantic frequency: F_NET, F_CODE, F_KEY, F_ADJ, F_NOUN, F_VOID, etc.
  value: string; // Raw value (literal string)
  phase: number; // Position index
}

export interface Grammar {
  id: string;
  name: string;
  version: string;
  frequencies: FrequencyDefinition[];
  patterns: PatternRule[];
}

export interface FrequencyDefinition {
  id: string; // e.g., "F_NET", "F_CODE", "F_KEY"
  name: string;
  description: string;
  regex?: string; // Pattern to match this frequency
  preserve?: boolean; // If true, never translate (identity mapping)
}

export interface PatternRule {
  rule_id: string;
  trigger_pattern: string[]; // Array of frequency IDs
  operation: 'phase_swap' | 'identity' | 'reformat';
  indices?: number[];
  target_order?: number[];
  description: string;
}

export interface Dictionary {
  source: string;
  target: string;
  lookup_hash: string;
  rules: DictionaryRule[];
}

export interface DictionaryRule {
  in: string;
  out: string;
  context?: string; // Optional context for disambiguation
}

export interface BasisMapping {
  description: string;
  map: MappingRule[];
}

export interface MappingRule {
  sb: string; // Source basis (frequency)
  tb: string; // Target basis (frequency)
  action: 'identity' | 'reformat' | 'dictionary_lookup';
  format?: string; // For reformat actions (e.g., "ISO8601")
}

export interface TranslationResult {
  original: string;
  refracted: RefractedToken[];
  transmuted?: RefractedToken[];
  projected?: string;
  trace?: TranslationTrace;
}

export interface TranslationTrace {
  refract_stage: {
    tokens: RefractedToken[];
    grammar_used: string;
  };
  transmute_stage?: {
    lexical_map_applied: Array<{ from: string; to: string }>;
    syntax_topology_applied?: Array<{ rule_id: string; description: string }>;
    intermediate_state: RefractedToken[];
  };
  project_stage?: {
    sorted_by_phase: RefractedToken[];
    concatenated: string;
  };
}

