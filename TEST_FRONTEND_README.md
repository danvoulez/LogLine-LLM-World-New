# 🧪 Frontend de Teste - LogLine LLM World

HTML simples para testar se o backend está deployado e funcionando no Vercel.

## 🚀 Como usar

### Opção 1: Abrir direto no navegador

```bash
# Abrir o arquivo HTML
open test-frontend.html
# ou
xdg-open test-frontend.html  # Linux
```

### Opção 2: Servir localmente (recomendado)

```bash
# Python 3
python3 -m http.server 8080

# Node.js (com http-server)
npx http-server -p 8080

# Depois acesse: http://localhost:8080/test-frontend.html
```

### Opção 3: Auto-test ao carregar

Adicione `?auto=true` na URL:
```
http://localhost:8080/test-frontend.html?auto=true
```

## 🔧 Configuração

1. **Backend URL**: 
   - Deixe vazio para auto-detectar
   - Ou coloque manualmente: `https://seu-backend.vercel.app` ou `http://localhost:3000`

2. **Testes disponíveis**:
   - 🧪 **Testar Tudo**: Testa todos os endpoints principais
   - ❤️ **Health Check**: Testa apenas `/api/v1/healthz`
   - 📋 **Workflows**: Testa listagem de workflows
   - 🔧 **Tools**: Testa listagem de tools

## 📊 O que é testado?

### Endpoints Core
- ✅ `/api/v1/healthz` - Health check
- ✅ `/api/v1/workflows` - List workflows
- ✅ `/api/v1/tools` - List tools
- ✅ `/api/v1/agents` - List agents
- ✅ `/api/v1/apps` - List apps

### Registry Endpoints
- ✅ `/api/v1/registry/people` - List people
- ✅ `/api/v1/registry/objects` - List objects
- ✅ `/api/v1/registry/ideas` - List ideas
- ✅ `/api/v1/registry/contracts` - List contracts

### Database
- ✅ `/api/v1/database/status` - Database status

## 🎯 Interpretando os resultados

### ✅ Sucesso (verde)
- Endpoint respondeu corretamente
- Status HTTP 200-299
- Dados retornados

### ❌ Erro (vermelho)
- Endpoint não respondeu
- Status HTTP 400+
- Erro de conexão (CORS, rede, etc.)

### ⚠️ Possíveis problemas

1. **CORS Error**: Backend precisa permitir CORS
   - ✅ Já configurado em `backend/api/index.ts`

2. **404 Not Found**: Endpoint não existe
   - Verificar se o deploy foi feito
   - Verificar se a rota está correta

3. **500 Internal Error**: Erro no backend
   - Verificar logs do Vercel
   - Verificar se o banco está conectado

4. **Network Error**: Backend não está acessível
   - Verificar URL do backend
   - Verificar se o Vercel está deployado

## 🔍 Verificando deploy no Vercel

1. Acesse: https://vercel.com/dashboard
2. Encontre seu projeto
3. Verifique:
   - ✅ Último deploy (deve ser recente)
   - ✅ Status: "Ready" (verde)
   - ✅ URL do deploy (copie para o HTML)

## 📝 Próximos passos

Se os testes passarem:
- ✅ Backend está deployado
- ✅ Endpoints estão funcionando
- ✅ Banco está conectado (se health check passar)

Se os testes falharem:
- 🔍 Verificar logs do Vercel
- 🔍 Verificar variáveis de ambiente
- 🔍 Verificar se as migrações foram executadas

---

**Dica**: Use o console do navegador (F12) para ver erros detalhados!

