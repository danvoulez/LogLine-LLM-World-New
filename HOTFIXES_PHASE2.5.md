# Hotfixes Críticos - Pré Phase 3

## Problemas Identificados

### 1. Vazamento de Segredos (CRÍTICO)
**Arquivo:** `backend/.env.production`
- Credenciais completas de banco Neon commitadas
- `VERCEL_OIDC_TOKEN` commitado
- **Ação:** Remover arquivo, adicionar ao .gitignore, documentar variáveis

### 2. Schema sem Migrações Completas
**Problema:** Tabelas core não têm migrações DDL
- `workflows`, `runs`, `steps`, `events`, `tools`, `agents`, `apps`, `app_scopes`, `app_workflows`, `app_actions`, `files`
- Prod novo não consegue subir só com o repo
- **Ação:** Criar migrações completas para todas as tabelas

### 3. Natural-language DB Write Tool Inseguro
**Arquivo:** `backend/src/tools/natural-language-db.tool.ts`
- Validação SQL só por prefixo (fura com CTEs, comentários, etc.)
- Sem dry-run real embutido
- Sem policies ativas
- **Ação:** Melhorar validação SQL, adicionar parser SQL, implementar dry-run obrigatório

### 4. Policy Engine Inexistente
**Problema:** Só existe na teoria, código tem `TODO: Policy check (Phase 4)`
- **Ação:** Documentar como placeholder para Phase 4, mas deixar claro que não está ativo

### 5. AgentContext previousSteps Vazio
**Arquivo:** `backend/src/execution/orchestrator.service.ts`
- Agent nodes e condition evaluator recebem `previousSteps: []`
- Router tem implementação, mas agent node não
- **Ação:** Carregar previousSteps do banco antes de chamar agent

### 6. TDLN-T Deterministic Incompleto
**Arquivo:** `backend/src/tdln-t/tdln-t.service.ts`
- Heurísticas incompletas (`TODO: Add more heuristics`)
- **Ação:** Documentar limitações atuais, não prometer determinismo forte ainda

### 7. Tools Built-in Sem Seed
**Problema:** Tools built-in dependem de rows manuais em `tools`
- `natural_language_db_read`, `natural_language_db_write`, `ticketing.list_open`
- Sem seed adequado, quebram em runtime
- **Ação:** Criar migration/seed para tools built-in

## Plano de Correção

### Prioridade 1 (Crítico - Segurança)
1. Remover `.env.production` do repo
2. Adicionar ao `.gitignore`
3. Criar `.env.example` com variáveis necessárias (sem valores)

### Prioridade 2 (Crítico - Deploy)
4. Criar migrações DDL completas para todas as tabelas
5. Criar seed para tools built-in

### Prioridade 3 (Importante - Funcionalidade)
6. Implementar previousSteps no AgentContext
7. Melhorar validação SQL no write tool
8. Documentar limitações (TDLN-T, Policy Engine)

