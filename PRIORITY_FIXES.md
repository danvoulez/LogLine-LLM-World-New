# 🔥 Prioridades de Correção - Railway (Hoje)

**Data:** 2025-11-21  
**Foco:** Problemas críticos que podem causar falhas em produção

---

## 🔴 CRÍTICO - Fazer AGORA (1-2 horas)

### 1. Resource Limits no Executor
**Problema**: Código malicioso pode crashar o container  
**Impacto**: Executor pode ficar indisponível  
**Solução**: Adicionar limites via Railway config + Docker

### 2. Browser Memory Leak
**Problema**: Puppeteer vaza memória, container OOM após ~50 requests  
**Impacto**: Executor para de funcionar após uso intenso  
**Solução**: Browser pool com max 3-5 instâncias, reuse

### 3. Rate Limiting no Executor
**Problema**: Um tenant pode esgotar recursos do executor  
**Impacto**: DoS acidental ou malicioso  
**Solução**: Rate limit por tenant (ex: 10 req/min)

---

## 🟡 IMPORTANTE - Fazer HOJE (2-3 horas)

### 4. Error Handling Melhorado
**Problema**: Erros do executor não são tratados adequadamente  
**Impacto**: UX ruim, difícil debugar  
**Solução**: Melhorar mensagens de erro, logging estruturado

### 5. Timeout Configurável
**Problema**: Timeout fixo de 5min pode ser muito/ pouco  
**Impacto**: Algumas operações falham desnecessariamente  
**Solução**: Timeout por tipo de tool (code: 2min, browser: 5min)

---

## 🟢 NICE TO HAVE - Depois

### 6. Structured Logging
- Substituir console.log por winston/pino
- Adicionar correlation IDs

### 7. Métricas
- Endpoint `/metrics` para Prometheus
- Contadores de execuções, erros, latência

---

## ❓ Problemas que você está vendo?

**Por favor, me diga:**
1. Quais erros você está vendo em produção/staging?
2. O executor está crashando? Com que frequência?
3. Há problemas de performance? Onde?
4. Algum erro específico que está bloqueando?

**Isso me ajuda a priorizar o que realmente importa!**

