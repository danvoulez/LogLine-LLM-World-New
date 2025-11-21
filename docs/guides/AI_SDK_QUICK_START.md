# Vercel AI SDK v5 Quick Start

Quick reference for integrating AI SDK v5 into LogLine Phase 2.

## Installation

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod
```

## Key Packages

- `ai` - Core AI SDK (v5)
- `@ai-sdk/openai` - OpenAI provider
- `@ai-sdk/anthropic` - Anthropic (Claude) provider  
- `@ai-sdk/google` - Google (Gemini) provider
- `zod` - Schema validation for tools and structured outputs

## Basic Usage Examples

### 1. Simple Text Generation

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Explain quantum computing in simple terms',
});
```

### 2. With Tool Calling

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get current weather for a location',
      parameters: z.object({
        location: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']).optional(),
      }),
      execute: async ({ location, unit }) => {
        // Your tool implementation
        return { temperature: 72, unit: unit || 'fahrenheit' };
      },
    }),
  },
});
```

### 3. Streaming

```typescript
import { streamText } from 'ai';

const stream = await streamText({
  model: openai('gpt-4o'),
  prompt: 'Write a story about a robot',
});

for await (const chunk of stream.textStream) {
  console.log(chunk);
}
```

### 4. Structured Outputs

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  prompt: 'Extract user information from: John, 30, john@example.com',
});
```

## Natural Language to SQL Pattern (Read & Write)

Based on the [Vercel template](https://vercel.com/templates/next.js/natural-language-postgres):

### Read Operations

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function naturalLanguageToSQL(query: string, schema: string) {
  const { text: sql } = await generateText({
    model: openai('gpt-4o'),
    prompt: `Convert this natural language query to PostgreSQL SQL SELECT:

Query: ${query}

Database Schema:
${schema}

IMPORTANT: Only generate SELECT queries (READ operations).
Return ONLY the SQL query, no explanation.`,
  });

  // Validate it's a SELECT query
  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    throw new Error('Security: Only SELECT queries allowed');
  }

  return sql;
}
```

### Write Operations

```typescript
async function naturalLanguageToWriteSQL(instruction: string, schema: string) {
  const { text: sql } = await generateText({
    model: openai('gpt-4o'),
    prompt: `Convert this natural language instruction to PostgreSQL SQL:

Instruction: ${instruction}

Database Schema:
${schema}

IMPORTANT:
- Generate INSERT or UPDATE statements only
- NEVER generate DELETE, DROP, TRUNCATE, or ALTER
- For UPDATE: Always include WHERE clause
- Return ONLY the SQL query, no explanation.`,
  });

  // Validate it's a safe write operation
  const sqlUpper = sql.trim().toUpperCase();
  if (sqlUpper.startsWith('DELETE') || 
      sqlUpper.startsWith('DROP') || 
      sqlUpper.startsWith('TRUNCATE')) {
    throw new Error('Security: Destructive operations not allowed');
  }

  return sql;
}
```

### Example Usage

```typescript
// Read: "Show me all failed runs"
const readSQL = await naturalLanguageToSQL(
  "Show me all failed runs from last week",
  schema
);
// Returns: SELECT * FROM runs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days'

// Write: "Create a new workflow"
const writeSQL = await naturalLanguageToWriteSQL(
  "Create a new workflow named 'Customer Onboarding' with type 'linear'",
  schema
);
// Returns: INSERT INTO workflows (name, type, ...) VALUES ('Customer Onboarding', 'linear', ...)
```

## Provider Switching

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

function getModel(provider: string, modelName: string) {
  switch (provider) {
    case 'openai':
      return openai(modelName);
    case 'anthropic':
      return anthropic(modelName);
    case 'google':
      return google(modelName);
    default:
      return openai('gpt-4o');
  }
}

// Use it
const model = getModel('anthropic', 'claude-3-5-sonnet-20241022');
```

## Environment Variables

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Resources

- [AI SDK v5 Docs](https://v5.ai-sdk.dev/)
- [Natural Language Postgres Template](https://vercel.com/templates/next.js/natural-language-postgres)
- [AI SDK GitHub](https://github.com/vercel/ai)
- [Zod Documentation](https://zod.dev/)

