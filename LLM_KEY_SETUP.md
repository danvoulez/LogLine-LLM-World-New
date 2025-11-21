# 🔑 Configuração de Chave LLM

## 📍 Onde Configurar

A chave de LLM deve ser configurada no **BACKEND (Vercel)**, não no frontend.

### Backend (Vercel)

1. **Acesse Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Projeto: `log-line-llm-world-new`
   - Settings → Environment Variables

2. **Adicione a variável:**
   ```
   OPENAI_API_KEY=sk-... (sua chave aqui)
   ```

3. **Ou outras providers:**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_GENERATIVE_AI_API_KEY=...
   ```

4. **Redeploy:**
   - Vercel vai fazer redeploy automaticamente
   - Ou force: Deployments → Redeploy

### Frontend (Opcional - apenas para URL do backend)

O frontend só precisa da URL do backend:

```bash
cd logline-ui
cp .env.local.example .env.local
```

Edite `.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=https://log-line-llm-world-new.vercel.app
```

## ✅ Verificação

Depois de configurar, teste:

```bash
# Testar backend
curl https://log-line-llm-world-new.vercel.app/api/v1/healthz

# Se funcionar, o backend está OK
```

## 🔐 Segurança

- ✅ **NUNCA** coloque chaves LLM no frontend
- ✅ **SEMPRE** use variáveis de ambiente no Vercel
- ✅ Chaves ficam no backend, frontend só chama APIs

---

**Quando você tiver a chave, me avise e eu ajudo a configurar!**

