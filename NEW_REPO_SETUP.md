# 🔄 Novo Repositório - Setup

## Status

Tentando criar novo repositório via API do GitHub.

## Próximos Passos (Após criar o repositório)

### 1. Atualizar Remote

```bash
git remote set-url origin <NOVO_REPO_URL>
```

### 2. Push para Novo Repositório

```bash
git push -u origin main
```

### 3. Conectar no Vercel

1. Acesse: https://vercel.com/dvoulez-team/logline-llm-world/settings/git
2. Clique em "Disconnect" (se conectado)
3. Clique em "Connect Git Repository"
4. Selecione o novo repositório
5. Configure:
   - Production Branch: `main`
   - Root Directory: (deixe vazio - vercel.json está na raiz)
6. Salve

Isso deve criar o webhook automaticamente!

