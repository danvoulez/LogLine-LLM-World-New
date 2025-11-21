# 🔑 Como as Chaves LLM Funcionam no Projeto

## 📍 Como os SDKs do Vercel AI Buscam as Chaves

O projeto usa os SDKs oficiais do Vercel AI (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`). Esses SDKs **automaticamente** leem as variáveis de ambiente quando você instancia os providers.

### Como Funciona:

```typescript
// backend/src/llm/llm-router.service.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// Quando você chama openai(), anthropic(), google() SEM parâmetros,
// eles automaticamente buscam as variáveis de ambiente:
// - openai() → process.env.OPENAI_API_KEY
// - anthropic() → process.env.ANTHROPIC_API_KEY
// - google() → process.env.GOOGLE_GENERATIVE_AI_API_KEY

const provider = this.getProvider(config.provider); // Retorna openai, anthropic ou google
const model = provider(config.model); // Aqui o SDK busca a chave automaticamente
```

### Variáveis de Ambiente Esperadas:

| SDK | Variável de Ambiente | Onde está configurado |
|-----|---------------------|----------------------|
| `@ai-sdk/openai` | `OPENAI_API_KEY` | ✅ Vercel (Production, Preview, Development) |
| `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` | ✅ Vercel (Production, Preview, Development) |
| `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ Vercel (Production, Preview, Development) |

### Onde as Chaves São Usadas:

1. **`LlmRouterService`** (`backend/src/llm/llm-router.service.ts`):
   - Usa `openai()`, `anthropic()`, `google()` para gerar texto
   - Usado por agentes para processar prompts

2. **`EmbeddingService`** (`backend/src/memory/embedding.service.ts`):
   - Usa `openai.embedding()`, `google.embedding()` para gerar embeddings
   - Usado para memória RAG e busca semântica

### Verificação:

Para verificar se as chaves estão sendo lidas corretamente:

```bash
# No Vercel, após deploy, verifique os logs:
vercel logs

# Ou teste localmente:
cd backend
node -e "console.log('OPENAI:', process.env.OPENAI_API_KEY ? '✅' : '❌')"
```

### ⚠️ Importante:

- **NUNCA** passe as chaves explicitamente no código
- Os SDKs fazem isso automaticamente via `process.env`
- No Vercel, as variáveis são injetadas automaticamente no runtime
- Não precisa de configuração adicional - os SDKs fazem tudo sozinhos!

### Referência:

- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [@ai-sdk/openai](https://github.com/vercel/ai/tree/main/packages/openai)
- [@ai-sdk/anthropic](https://github.com/vercel/ai/tree/main/packages/anthropic)
- [@ai-sdk/google](https://github.com/vercel/ai/tree/main/packages/google)

---

**Status Atual:** ✅ Todas as chaves configuradas no Vercel via CLI

