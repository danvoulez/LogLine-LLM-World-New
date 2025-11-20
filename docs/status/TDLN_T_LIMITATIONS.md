# TDLN-T Current Limitations

## Overview

TDLN-T (Deterministic Translation Protocol) is designed to structure natural language into JSON✯Atomic format and provide deterministic translation for cost savings. However, the current implementation (v1) has several limitations that should be understood before use.

## Current Status: v1 (Heuristic-Based)

### ✅ What Works Well

- **Structuring**: Basic structuring of natural language into JSON✯Atomic format
- **Simple Patterns**: Deterministic handling of simple, repetitive patterns
- **Cost Savings**: When deterministic path is taken, no LLM call is made
- **Language-Agnostic Structure**: JSON✯Atomic format works for any language

### ⚠️ Current Limitations

#### 1. Deterministic Task Detection (Heuristic-Based)

**Status**: Incomplete heuristics

The `isDeterministicTask()` method uses pattern matching to detect "simple" tasks that can be handled deterministically. However:

- **Heuristics are incomplete**: Only basic patterns are detected
- **No guarantee of determinism**: Complex sentences, idioms, context-dependent phrases may slip through
- **False positives/negatives**: Some simple tasks may be routed to LLM, some complex ones may be attempted deterministically

**Example patterns currently detected:**
- Simple greetings ("hello", "hi")
- Basic commands ("list", "show", "get")
- Simple questions with known patterns

**What's NOT detected:**
- Context-dependent meanings
- Idioms and colloquialisms
- Complex multi-clause sentences
- Ambiguous references

#### 2. Refraction Quality

**Status**: Basic tokenization

The `refract()` operation breaks text into semantic components, but:

- **Word-level only**: Not semantic-level analysis
- **Simple tokenization**: Uses regex-based word splitting, not NLP
- **Frequency identification**: Pattern-based, not semantic understanding
- **No relationship detection**: Doesn't capture semantic relationships between tokens

**Impact**: Structured output may not capture full semantic meaning.

#### 3. Grammar Support

**Status**: Limited to English

- Currently only `grammar_en_us_strict` is available
- Other languages require grammar definitions
- No automatic language detection

#### 4. Dictionary Coverage

**Status**: Limited mappings

- Dictionary has limited entries
- Missing entries fall back to identity mapping (no translation)
- No automatic dictionary expansion

## Recommendations

### When to Use TDLN-T

✅ **Good for:**
- Simple, repetitive tasks
- Structured data extraction (names, dates, numbers)
- Basic command parsing
- Cost-sensitive operations where some accuracy loss is acceptable

### When to Use LLM

❌ **Not recommended for:**
- Complex reasoning tasks
- Context-dependent translation
- Creative or generative tasks
- Critical operations requiring high accuracy
- Ambiguous or multi-meaning inputs

### Best Practices

1. **Always validate output** for critical operations
2. **Use LLM fallback** when TDLN-T confidence is low
3. **Monitor accuracy** and adjust heuristics based on real-world usage
4. **Don't rely on determinism** for security-critical operations

## Future Improvements (Planned)

### Phase 2 Enhancements

- [ ] Enhanced heuristics for deterministic task detection
- [ ] Confidence scoring for deterministic vs LLM decision
- [ ] Expanded pattern library
- [ ] Context-aware pattern matching

### Phase 3 Enhancements

- [ ] NLP-powered semantic analysis for refraction
- [ ] Semantic relationship detection
- [ ] Multi-language grammar support
- [ ] Automatic language detection

### Phase 4 Enhancements

- [ ] Machine learning for pattern recognition
- [ ] Adaptive dictionary expansion
- [ ] Quality metrics and monitoring
- [ ] A/B testing framework for deterministic vs LLM

## Technical Details

### Current Heuristics

The `isDeterministicTask()` method checks for:

```typescript
// Simple patterns (examples)
- Greetings: "hello", "hi", "hey"
- Commands: "list", "show", "get", "find"
- Questions: "what is", "how many", "where is"
- Short length: < 50 characters
```

### Confidence Levels

Currently, TDLN-T does NOT provide confidence scores. All deterministic tasks are treated equally.

**Future**: Confidence scoring will help decide when to fall back to LLM.

## Conclusion

TDLN-T v1 is a **proof of concept** and **cost optimization tool**, not a production-ready deterministic translation system. Use it for:

- Cost savings on simple, repetitive tasks
- Structuring natural language for LLM consumption
- Learning and experimentation

Do NOT use it for:
- Critical security operations
- High-accuracy requirements
- Complex reasoning tasks
- Production systems without LLM fallback

The system is designed to gracefully fall back to LLM when deterministic path is not appropriate, ensuring functionality is never compromised for cost savings.

