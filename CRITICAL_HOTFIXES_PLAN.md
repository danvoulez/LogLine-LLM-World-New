# Critical Hotfixes Plan - Pré Phase 3

## Objetivo

Corrigir 7 problemas críticos identificados antes de iniciar Phase 3, garantindo segurança, deployabilidade e funcionalidade correta do sistema.

---

## HOTFIX 1: Vazamento de Segredos (CRÍTICO - Segurança)

### Problema
- `backend/.env.production` commitado com credenciais completas
- `VERCEL_OIDC_TOKEN` exposto
- Qualquer pessoa com acesso ao repo pode reconstituir ambiente prod

### Ação

1. **Remover arquivo do repo**
   - Deletar `backend/.env.production`
   - Remover do histórico git (se necessário, usar `git filter-branch` ou BFG)

2. **Atualizar .gitignore**
   - Garantir que `.env*` está ignorado
   - Adicionar padrões específicos se necessário

3. **Criar .env.example**
   - `backend/.env.example` com todas as variáveis necessárias
   - Sem valores reais, apenas placeholders e descrições

4. **Documentar variáveis**
   - Criar `backend/ENV_VARIABLES.md` listando todas as variáveis necessárias
   - Explicar onde obter cada valor (Vercel dashboard, etc.)

**Arquivos:**
- `backend/.env.production` (DELETAR)
- `.gitignore` (MODIFY)
- `backend/.env.example` (NEW)
- `backend/ENV_VARIABLES.md` (NEW)

**Prioridade:** CRÍTICA - Fazer primeiro

---

## HOTFIX 2: Schema sem Migrações Completas (CRÍTICO - Deploy)

### Problema
- Tabelas core não têm migrações DDL
- Prod novo não consegue subir só com o repo
- Depende de `synchronize: true` em dev

### Ação

1. **Criar migração inicial completa**
   - `backend/src/database/migrations/0003-create-core-tables.ts`
   - Criar todas as tabelas: `workflows`, `runs`, `steps`, `events`, `tools`, `agents`, `apps`, `app_scopes`, `app_workflows`, `app_actions`, `files`
   - Incluir índices, foreign keys, constraints
   - Incluir campos de execution budgets (`cost_limit_cents`, `llm_calls_limit`, `latency_slo_ms`)

2. **Garantir ordem correta**
   - Migrações devem respeitar dependências (FKs)
   - Testar em banco limpo

3. **Atualizar documentação**
   - `backend/README.md` - instruções de migração
   - `MASTER_BLUEPRINT.md` - referenciar migrações

**Arquivos:**
- `backend/src/database/migrations/0003-create-core-tables.ts` (NEW)
- `backend/README.md` (MODIFY)
- `MASTER_BLUEPRINT.md` (MODIFY - referência a migrações)

**Prioridade:** CRÍTICA - Fazer em seguida

---

## HOTFIX 3: Natural-language DB Write Tool Inseguro

### Problema
- Validação SQL só por prefixo (fura com CTEs, comentários, transações)
- Sem dry-run real obrigatório
- Sem policies ativas

### Ação

1. **Melhorar validação SQL**
   - Usar parser SQL (ex: `node-sql-parser` ou similar)
   - Detectar operações bloqueadas em qualquer lugar da query
   - Validar estrutura completa, não só prefixo
   - Bloquear: DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE, BEGIN/COMMIT/ROLLBACK

2. **Tornar dry-run obrigatório por padrão**
   - `dryRun: true` por padrão
   - Exigir `confirm: true` explicitamente para executar
   - Retornar SQL proposto sempre antes de executar

3. **Adicionar validação de transações**
   - Detectar `BEGIN`, `COMMIT`, `ROLLBACK`
   - Bloquear transações explícitas (já temos transação automática)

4. **Documentar limitações**
   - Adicionar JSDoc explicando validações
   - Documentar que policies serão adicionadas em Phase 4

**Arquivos:**
- `backend/src/tools/natural-language-db.tool.ts` (MODIFY)
- `backend/package.json` (MODIFY - adicionar `node-sql-parser` ou similar)

**Prioridade:** ALTA - Segurança importante

---

## HOTFIX 4: AgentContext previousSteps Vazio

### Problema
- Agent nodes e condition evaluator recebem `previousSteps: []`
- Router tem implementação, mas agent node não
- Inconsistente com blueprint/spec

### Ação

1. **Carregar previousSteps no orchestrator**
   - Modificar `executeAgentNode` para carregar steps anteriores do run
   - Modificar `evaluateConditionalEdges` para carregar steps anteriores
   - Limitar a últimos N steps (ex: 10) para performance

2. **Formato de previousSteps**
   - Usar formato: `Array<{ node_id: string; output?: any }>`
   - Incluir apenas steps completados
   - Ordenar por `started_at` ASC

3. **Otimização**
   - Cachear steps carregados se já foram carregados no mesmo run
   - Considerar paginação para runs muito longos

**Arquivos:**
- `backend/src/execution/orchestrator.service.ts` (MODIFY)
  - `executeAgentNode` - carregar previousSteps
  - `evaluateConditionalEdges` - carregar previousSteps

**Prioridade:** MÉDIA - Funcionalidade importante, mas não quebra sistema

---

## HOTFIX 5: Tools Built-in Sem Seed

### Problema
- Tools built-in dependem de rows manuais em `tools`
- Sem seed adequado, quebram em runtime
- `natural_language_db_read`, `natural_language_db_write`, `ticketing.list_open`

### Ação

1. **Criar migration/seed para tools built-in**
   - `backend/src/database/migrations/0004-seed-builtin-tools.ts`
   - Criar registros para:
     - `natural_language_db_read`
     - `natural_language_db_write`
     - `ticketing.list_open` (placeholder)

2. **Schema correto para cada tool**
   - `input_schema` JSON Schema válido
   - `description` clara
   - `handler_type: 'builtin'`

3. **Integrar com SetupDefaultAgentsService**
   - Criar `SetupDefaultToolsService` similar
   - Ou incluir tools no mesmo serviço de setup

**Arquivos:**
- `backend/src/database/migrations/0004-seed-builtin-tools.ts` (NEW)
- `backend/src/tools/setup-default-tools.service.ts` (NEW - opcional)
- `backend/src/tools/tools.module.ts` (MODIFY - adicionar setup service)

**Prioridade:** ALTA - Sistema não funciona sem isso

---

## HOTFIX 6: TDLN-T Deterministic Incompleto

### Problema
- Heurísticas incompletas (`TODO: Add more heuristics`)
- Promessa de determinismo forte não sustentada pelo código

### Ação

1. **Documentar limitações atuais**
   - Adicionar JSDoc no `TdlnTService` explicando:
     - Determinismo atual é heurístico
     - Não garante 100% de determinismo
     - Depende de padrões conhecidos

2. **Melhorar heurísticas existentes**
   - Expandir `isDeterministicTask` com mais padrões
   - Adicionar validação de complexidade
   - Documentar casos onde TDLN-T é apropriado vs LLM

3. **Atualizar blueprint**
   - Seção sobre TDLN-T deve mencionar limitações
   - Não prometer determinismo absoluto ainda

**Arquivos:**
- `backend/src/tdln-t/tdln-t.service.ts` (MODIFY - documentação)
- `MASTER_BLUEPRINT.md` (MODIFY - limitações TDLN-T)

**Prioridade:** BAIXA - Documentação, não quebra funcionalidade

---

## HOTFIX 7: Policy Engine Inexistente (Documentação)

### Problema
- Policy engine existe só na teoria
- Código tem `TODO: Policy check (Phase 4)`
- Pode causar confusão sobre segurança

### Ação

1. **Documentar status atual**
   - Adicionar comentários claros: "Policy Engine será implementado em Phase 4"
   - Não remover TODOs, mas deixar claro que é placeholder

2. **Criar documento de status**
   - `docs/status/POLICY_ENGINE_STATUS.md`
   - Explicar que policies são Phase 4
   - Listar onde estão os placeholders

3. **Atualizar blueprint**
   - Marcar Policy Engine como Phase 4
   - Deixar claro que não está ativo ainda

**Arquivos:**
- `docs/status/POLICY_ENGINE_STATUS.md` (NEW)
- `MASTER_BLUEPRINT.md` (MODIFY - clarificar Phase 4)

**Prioridade:** BAIXA - Documentação, não quebra funcionalidade

---

## Ordem de Execução

### Fase 1: Segurança Crítica (Imediato)
1. HOTFIX 1 - Remover .env.production
2. HOTFIX 3 - Melhorar validação SQL (parcial - pelo menos melhorar validação)

### Fase 2: Deployabilidade (Crítico)
3. HOTFIX 2 - Criar migrações completas
4. HOTFIX 5 - Seed para tools built-in

### Fase 3: Funcionalidade (Importante)
5. HOTFIX 4 - Implementar previousSteps
6. HOTFIX 3 - Completar validação SQL (parser)

### Fase 4: Documentação (Melhoria)
7. HOTFIX 6 - Documentar limitações TDLN-T
8. HOTFIX 7 - Documentar status Policy Engine

---

## Critérios de Sucesso

- ✅ `.env.production` removido do repo e histórico
- ✅ Migrações completas permitem deploy em banco limpo
- ✅ Tools built-in criados automaticamente
- ✅ Validação SQL previne SQL injection básico
- ✅ AgentContext tem previousSteps carregados
- ✅ Documentação clara sobre limitações

---

## Estimativa

- Fase 1 (Segurança): 2-3 horas
- Fase 2 (Deploy): 4-6 horas
- Fase 3 (Funcionalidade): 3-4 horas
- Fase 4 (Documentação): 1-2 horas
- **Total: 10-15 horas**

