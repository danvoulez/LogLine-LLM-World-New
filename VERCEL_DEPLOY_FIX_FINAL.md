# ⚠️ Vercel Auto-Deploy - Problema e Solução

## Problema
O deploy automático **NÃO está funcionando** mesmo com todas as configurações via CLI.

## Causa Provável
O Vercel precisa que o **Git seja conectado via Dashboard**, não apenas via CLI. O webhook do GitHub pode não estar configurado corretamente.

## Solução: Configurar no Dashboard do Vercel

### Passo 1: Desconectar Git (se já estiver conectado)
1. Acesse: **https://vercel.com/dvoulez-team/logline-llm-world/settings/git**
2. Se houver conexão, clique em **"Disconnect"**
3. Aguarde confirmação

### Passo 2: Conectar Git Novamente
1. Na mesma página, clique em **"Connect Git Repository"**
2. Selecione: **GitHub**
3. Autorize o Vercel (se necessário)
4. Selecione o repositório: **`danvoulez/LogLine-LLM-World`**
5. Configure:
   - **Production Branch:** `main`
   - **Root Directory:** **DEIXE VAZIO** (não coloque `backend`)
   - **Framework Preset:** Other
6. Clique em **"Connect"**

### Passo 3: Verificar Build Settings
1. Vá para: **Settings → General**
2. Verifique:
   - **Root Directory:** **VAZIO** (não `backend`)
   - **Build Command:** `cd backend && npm run build`
   - **Output Directory:** `backend/dist`
   - **Install Command:** `cd backend && npm install`

**OU** deixe tudo vazio e deixe o `vercel.json` na raiz fazer o trabalho.

### Passo 4: Testar
```bash
git commit --allow-empty -m "Test: Vercel auto-deploy after dashboard fix"
git push
```

**Verifique no dashboard:** https://vercel.com/dvoulez-team/logline-llm-world

Deve aparecer um novo deployment em 1-2 minutos.

## Por Que Isso É Necessário

O CLI pode dizer que o Git está conectado, mas o **webhook do GitHub** precisa ser criado/atualizado via dashboard. Sem o webhook correto, o GitHub não notifica o Vercel sobre novos commits.

## Verificação Final

Após conectar via dashboard:
1. Vá para: **Settings → Git**
2. Deve mostrar:
   - ✅ Repository: `danvoulez/LogLine-LLM-World`
   - ✅ Production Branch: `main`
   - ✅ Auto-deploy: Enabled
   - ✅ Webhook URL (deve estar visível)

3. No GitHub, vá para: **Settings → Webhooks**
4. Deve haver um webhook do Vercel com status **Active** (verde)

## Se Ainda Não Funcionar

1. Verifique se o repositório é **privado** - pode precisar de permissões especiais
2. Verifique se há **branch protection** no GitHub bloqueando
3. Tente criar um novo projeto no Vercel e conectar do zero

