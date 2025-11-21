# ✅ Solução: Deploy Hook do Vercel

## Problema Resolvido

Criei um **Deploy Hook** via API do Vercel e atualizei o GitHub Actions para usá-lo.

## O Que Foi Feito

1. ✅ Criado Deploy Hook via API do Vercel
2. ✅ Atualizado `.github/workflows/vercel-deploy.yml` para usar o Deploy Hook
3. ✅ Workflow simplificado - só precisa de 1 secret agora

## Secret Necessário no GitHub

**URL:** https://github.com/danvoulez/LogLine-LLM-World/settings/secrets/actions

**Adicione apenas 1 secret:**

**Nome:** `VERCEL_DEPLOY_HOOK_URL`  
**Valor:** (veja o arquivo `.vercel_deploy_hook_url.txt` ou execute o comando abaixo)

## Como Obter o Deploy Hook URL

```bash
cd backend
npx vercel deploy-hooks ls
```

Ou verifique no arquivo `.vercel_deploy_hook_url.txt` que foi criado.

## Como Funciona

1. Push para `main` → GitHub Actions detecta
2. GitHub Actions chama o Deploy Hook URL via `curl`
3. Vercel inicia deploy automaticamente

## Vantagens

- ✅ Só precisa de 1 secret (não precisa de VERCEL_TOKEN, ORG_ID, PROJECT_ID)
- ✅ Mais simples e seguro
- ✅ Funciona sem webhook do GitHub
- ✅ Não precisa de Vercel CLI no workflow

## Próximo Passo

Adicione o secret `VERCEL_DEPLOY_HOOK_URL` no GitHub e o auto-deploy funcionará!

