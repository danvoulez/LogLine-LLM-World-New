# 🔄 Consolidação de Migrações

**Data:** 2025-11-21  
**Status:** ✅ Completo

## 📋 O que foi feito?

Consolidamos **23 migrações** (0001-0023) em **1 única migração inicial** (`0001-initial-schema-consolidated.ts`).

### Por quê?

1. **Banco vazio**: Não há dados para migrar
2. **Simplicidade**: Uma migração é mais fácil de manter
3. **Performance**: Executa muito mais rápido
4. **Clareza**: Schema completo em um único lugar

## 🚀 Como usar

### ⚠️ IMPORTANTE: Escolha UMA estratégia

**Você NÃO pode usar ambas as estratégias no mesmo banco!**

### Opção 1: Banco Novo (Recomendado)

Se você está começando do zero:

```bash
# 1. Certifique-se de que o banco está vazio
# 2. A migração consolidada (0000) executará primeiro
# 3. As outras migrações (0001-0023) serão ignoradas (tabelas já existem)
npm run migration:run
```

**Como funciona:**
- A migração `0000-initial-schema-consolidated.ts` tem timestamp `1700000000000` (menor)
- Ela executa primeiro e cria todo o schema
- As migrações antigas (0001-0023) tentam executar, mas falham silenciosamente porque as tabelas já existem (usando `CREATE TABLE IF NOT EXISTS`)

### Opção 2: Banco Existente

Se você já tem dados e quer manter histórico:

1. **Remova** a migração consolidada temporariamente
2. Execute as migrações antigas (0001-0023) em ordem
3. Depois, você pode adicionar a consolidada de volta (ela será ignorada)

## 📁 Estrutura

```
backend/src/database/migrations/
├── 0000-initial-schema-consolidated.ts  ← NOVA (executa PRIMEIRO, timestamp: 1700000000000)
├── 0001-enable-pgvector.ts              ← ANTIGA (timestamp: 1763666210000, será ignorada se consolidada rodar)
├── 0003-create-core-tables.ts           ← ANTIGA (será ignorada se consolidada rodar)
├── ... (outras 21 migrações antigas)
└── 0023-seed-standard-tools.ts          ← ANTIGA (será ignorada se consolidada rodar)
```

**Nota**: A migração consolidada tem timestamp menor (`1700000000000`), então executa primeiro. As outras usam `CREATE TABLE IF NOT EXISTS`, então são seguras mesmo se executarem depois.

## ⚠️ Importante

- **Banco vazio**: Use `0001-initial-schema-consolidated.ts`
- **Banco com dados**: Use as migrações antigas (0001-0023) em ordem
- **Nunca execute ambas**: Escolha uma estratégia e mantenha consistente

## 🔍 O que está incluído na migração consolidada?

✅ Extensions (pgvector)  
✅ Core Execution (workflows, runs, steps, events)  
✅ Tools & Agents (com todos os campos do Registry)  
✅ App Layer (apps, scopes, workflows, actions)  
✅ Files  
✅ Memory & RAG (com índices vector)  
✅ Policies  
✅ Auth (users, sessions, api_keys)  
✅ Audit & Alerts  
✅ Registry: People (core_people, tenant_people_relationships)  
✅ Registry: Objects (com movimentos)  
✅ Registry: Ideas & Contracts (com campos INTEGER para dinheiro)  
✅ Registry: Relationships  
✅ Registry: Agent Training & Evaluation  
✅ Todos os Foreign Keys  
✅ Todos os Índices  
✅ Seeds: Tools padrão (natural_language_db, memory, registry, standard)  
✅ Seeds: Agents padrão (router, condition_evaluator)  

## 🧪 Testando

```bash
# 1. Dropar banco (CUIDADO: apaga tudo!)
dropdb logline

# 2. Criar banco novo
createdb logline

# 3. Executar migração consolidada
cd backend
npm run migration:run

# 4. Verificar
psql logline -c "\dt"  # Listar tabelas
```

## 📝 Próximos Passos

1. ✅ Migração consolidada criada
2. ⏳ Atualizar `app.module.ts` para usar apenas a consolidada (opcional)
3. ⏳ Documentar processo de rollback (se necessário)
4. ⏳ Testar em ambiente de staging

---

**Nota**: As migrações antigas (0001-0023) foram mantidas para referência histórica, mas não devem ser executadas em bancos novos.

