# 🔧 Correção de Deploy Vercel

## ❌ Problema

O Vercel está retornando 404 porque a configuração do `vercel.json` não está correta.

## ✅ Solução

### Opção 1: Configurar Root Directory (RECOMENDADO)

1. **Acesse Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Encontre o projeto `log-line-llm-world-new`
   - Vá em **Settings** → **General**

2. **Configure Root Directory:**
   - **Root Directory**: `backend`
   - Salvar

3. **Redeploy:**
   - Vercel vai usar automaticamente `backend/vercel.json`
   - Ou faça push para GitHub para trigger automático

### Opção 2: Corrigir vercel.json da Raiz

Já corrigi o `vercel.json` da raiz adicionando a configuração de `functions`.

Agora você precisa:

1. **Fazer commit e push:**
   ```bash
   git add vercel.json
   git commit -m "fix: corrigir configuração do Vercel"
   git push
   ```

2. **Ou fazer deploy manual:**
   ```bash
   vercel --prod
   ```

## 🧪 Testar

Depois do deploy, teste:

```bash
# Health check
curl https://log-line-llm-world-new.vercel.app/api/v1/healthz

# Deve retornar:
# {"status":"ok","timestamp":"...","database":"connected","uptime":...}
```

## 📝 Estrutura Correta

```
projeto/
├── vercel.json          # Configuração (raiz) - opcional
├── backend/
│   ├── vercel.json     # Configuração (backend) - preferido
│   ├── api/
│   │   └── index.ts    # Serverless function
│   └── dist/
│       └── api/
│           └── index.js # Compilado
```

## ⚠️ Importante

- Se usar **Root Directory = `backend`**: Use `backend/vercel.json`
- Se usar **Root Directory = `.`** (raiz): Use `vercel.json` da raiz

**Recomendação**: Use Root Directory = `backend` e `backend/vercel.json`

