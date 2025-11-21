# Phase 3.5: Core Improvements

## Objetivo

Melhorar funcionalidades já implementadas antes de partir para Phase 4:
1. Router nodes - Melhorias na implementação
2. Conditional edges - Melhorias na avaliação
3. Execution budgets - Enforcement de limites
4. TDLN-T determinism - Mais heurísticas

## 1. Router Nodes - Melhorias

### Problemas Identificados
- Router nodes podem precisar de melhor tratamento de erros
- Avaliação de condições pode ser mais robusta
- Logging pode ser mais detalhado

### Melhorias
- ✅ Melhor tratamento de erros quando router agent falha
- ✅ Validação de routes antes de executar
- ✅ Logging detalhado de decisões de routing
- ✅ Fallback para edge padrão se nenhuma condição match

## 2. Conditional Edges - Melhorias

### Problemas Identificados
- Avaliação via agent pode ser custosa
- Pode precisar de cache para condições simples
- Melhor tratamento de condições booleanas

### Melhorias
- ✅ Cache para condições determinísticas
- ✅ Avaliação mais eficiente
- ✅ Melhor logging de decisões

## 3. Execution Budgets - Enforcement

### Status Atual
- ✅ Campos no schema: `cost_limit_cents`, `llm_calls_limit`, `latency_slo_ms`
- ❌ Enforcement não implementado

### Implementação
- ✅ Tracking de custo por run (LLM calls + tools)
- ✅ Tracking de número de LLM calls
- ✅ Tracking de latência
- ✅ Encerrar run se budget excedido
- ✅ Evento `budget_exceeded` quando limite atingido

## 4. TDLN-T Determinism - Mais Heurísticas

### Status Atual
- ✅ Heurísticas básicas implementadas
- ⚠️ Mais casos podem ser cobertos

### Melhorias
- ✅ Mais patterns para tarefas determinísticas
- ✅ Melhor detecção de tradução simples
- ✅ Cache de resultados refratados

## Ordem de Implementação

1. **Execution Budgets** (mais crítico)
2. **Router Nodes** (melhorias)
3. **Conditional Edges** (otimizações)
4. **TDLN-T Determinism** (expansão)

