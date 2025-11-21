# 🗄️ Inicialização do Banco de Dados

## ⚠️ Status Atual

**O banco de dados NÃO foi inicializado ainda!**

As migrações estão configuradas mas **não rodam automaticamente** (`migrationsRun: false` no `app.module.ts`).

## 🚀 Como Inicializar

### Opção 1: Local (Desenvolvimento)

```bash
cd backend

# 1. Certifique-se de que o .env tem POSTGRES_URL
# Ou configure DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE

# 2. Execute as migrações
npm run migration:run:dev
```

### Opção 2: Vercel (Produção)

#### Via Vercel CLI (Recomendado):

```bash
cd backend

# 1. Build do projeto
npm run build

# 2. Execute migrações usando Vercel CLI
vercel env pull .env.production  # Baixar variáveis de ambiente
npm run migration:run
```

#### Via Script Manual:

```bash
cd backend

# 1. Build
npm run build

# 2. Execute com variáveis do Vercel
POSTGRES_URL="sua-url-do-vercel" npm run migration:run
```

#### Via API Endpoint (Futuro):

Podemos criar um endpoint `POST /api/v1/database/migrate` que executa as migrações. Por enquanto, use o script acima.

## 📋 O que as Migrações Fazem

A migração consolidada (`0000-initial-schema-consolidated.ts`) cria:

✅ **Extensions:**
- `vector` (pgvector para embeddings)

✅ **Tabelas Core:**
- `workflows`, `runs`, `steps`, `events`
- `tools`, `agents`
- `apps`, `app_scopes`, `app_workflows`, `app_actions`
- `files`
- `memory_items`, `resources`
- `policies`
- `users`, `sessions`, `api_keys`
- `audit_logs`, `alert_configs`, `alert_history`

✅ **Registry Universal:**
- `core_people`, `tenant_people_relationships`
- `registry_objects`, `registry_object_movements`
- `registry_ideas`, `registry_idea_votes`
- `registry_contracts`, `registry_contract_state_history`
- `registry_contract_templates`
- `registry_relationships`
- `registry_agent_training_history`, `registry_agent_evaluations`
- `registry_agent_execution_logs`

✅ **Seeds:**
- Tools padrão (natural_language_db, memory, registry, standard)
- Agents padrão (router, condition_evaluator)

## 🔍 Verificar se o Banco Foi Inicializado

### Local:

```bash
psql $POSTGRES_URL -c "\dt"  # Listar tabelas
psql $POSTGRES_URL -c "SELECT COUNT(*) FROM workflows;"  # Verificar dados
```

### Vercel:

```bash
# Via health check
curl https://log-line-llm-world-new.vercel.app/healthz

# Se retornar "database: connected", o banco está acessível
# Mas isso não significa que as migrações rodaram!
```

## ⚠️ Importante

1. **Backup**: Se você já tem dados, faça backup antes de rodar migrações
2. **Banco Vazio**: A migração consolidada é para bancos vazios
3. **Produção**: Sempre teste em staging antes de produção
4. **Rollback**: Não há rollback automático - faça backup!

## 📝 Próximos Passos

1. ✅ Script de migração criado (`scripts/run-migrations.ts`)
2. ⏳ Executar migrações no Vercel
3. ⏳ Verificar se tabelas foram criadas
4. ⏳ Testar endpoints da API

---

**Status:** ⚠️ Banco **NÃO inicializado** - Execute `npm run migration:run` para inicializar

