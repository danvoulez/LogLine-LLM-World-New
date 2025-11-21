# 🔍 Recuperar Projeto no Vercel

## Problema

O projeto `logline-llm-world` não aparece mais no Vercel.

## Possíveis Causas

1. Projeto foi desconectado quando mudamos o repositório
2. Projeto foi deletado acidentalmente
3. Mudança de organização/team

## Soluções

### Opção 1: Recriar Projeto no Vercel

1. Acesse: https://vercel.com/new
2. Selecione: **Import Git Repository**
3. Escolha: `LogLine-LLM-World-New`
4. Configure:
   - **Project Name:** `logline-llm-world`
   - **Root Directory:** (deixe vazio - vercel.json está na raiz)
   - **Framework Preset:** Other
5. Clique em **Deploy**

### Opção 2: Verificar via CLI

```bash
# Listar todos os projetos
npx vercel project ls

# Verificar se o projeto existe
npx vercel project ls | grep logline

# Se não existir, criar novo
cd backend
npx vercel link
```

### Opção 3: Verificar no Dashboard

1. Acesse: https://vercel.com/dashboard
2. Verifique se está na organização correta: `dvoulez-team`
3. Procure por `logline-llm-world` ou `LogLine-LLM-World-New`

## Próximos Passos

Após recriar/conectar:
1. Conecte a base de dados novamente
2. Configure environment variables
3. Faça deploy

