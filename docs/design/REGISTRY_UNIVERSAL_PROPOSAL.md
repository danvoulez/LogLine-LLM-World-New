# 🌐 Registry Universal - Proposta Expandida

**Data:** 2024-12-19  
**Status:** Proposta Expandida  
**Prioridade:** Crítica (fundação do ecossistema)

---

## 🎯 Visão Geral

O **Registry Universal** é o coração do LogLineOS - um repositório centralizado e multitenant que gerencia:

1. **Apps** - Aplicações (marketplace público)
2. **Pessoas** - Identidades universais (LogLine ID)
3. **Contratos** - Acordos executáveis (máquina de estados)
4. **Ideias** - Democracia orçamentária (votação colaborativa)
5. **Objetos** - Matéria inanimada rastreável (documentos, mercadorias, estoque, etc.)

**Princípios:**
- ✅ **Multitenant** - Isolamento por tenant quando necessário
- ✅ **Cross-App** - Compartilhamento entre apps quando apropriado
- ✅ **Apps Participam** - Apps podem criar/ler/atualizar entidades
- ✅ **Registry Único** - Uma API unificada para todos os tipos

---

## 📋 1. PESSOAS - Sistema de Identidade Universal

### 1.1. Conceito

**Problema:** Fragmentação de identidades digitais onde a mesma pessoa existe como múltiplas entidades desconectadas.

**Solução:** Identidade universal (LogLine ID) que atravessa todo o ecossistema, com dados específicos por tenant.

### 1.2. Arquitetura de Dois Níveis

#### Nível Cross-App (Universal)
- **LogLine ID**: `LL-BR-2024-000123456` (único, permanente)
- **Identificadores**: CPF hash, email primário
- **Portabilidade**: Mesma credencial serve para qualquer app
- **KYC**: Uma vez, válido em todo ecossistema

#### Nível Tenant (Isolado)
- **Dados específicos**: Relacionamento com aquele tenant
- **Privacidade**: Tenant A não vê dados de Tenant B
- **Roles**: customer, vendor, employee, admin (por tenant)

### 1.3. Schema

```sql
-- Identidade Universal (Cross-App)
CREATE TABLE core_people (
  logline_id      VARCHAR(50) PRIMARY KEY, -- 'LL-BR-2024-000123456'
  cpf_hash        VARCHAR(255) UNIQUE, -- Hash do CPF (privacy)
  email_primary   VARCHAR(255) UNIQUE,
  name            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_core_people_cpf_hash ON core_people(cpf_hash);
CREATE INDEX idx_core_people_email ON core_people(email_primary);

-- Relacionamento Tenant-Pessoa (Isolado)
CREATE TABLE tenant_people_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logline_id      VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
  tenant_id       UUID NOT NULL,
  role            TEXT NOT NULL, -- 'customer' | 'vendor' | 'employee' | 'admin'
  tenant_specific_data JSONB, -- Dados específicos do tenant
  permissions     JSONB, -- Permissões específicas
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(logline_id, tenant_id)
);

CREATE INDEX idx_tenant_people_tenant ON tenant_people_relationships(tenant_id);
CREATE INDEX idx_tenant_people_role ON tenant_people_relationships(tenant_id, role);
```

### 1.4. Fluxo de Vinculação

```
Cenário 1: Pessoa nova
→ Tenant cadastra cliente
→ Sistema gera LogLine ID
→ Pessoa tem identidade universal

Cenário 2: Pessoa já existe
→ Tenant tenta cadastrar
→ Sistema detecta CPF/email existente
→ Oferece vinculação: "Você já tem LogLine ID. Deseja usar?"
  ├─ SIM → Vincula cadastro tenant ao ID existente
  └─ NÃO → Cria cadastro isolado (sem ID universal)
```

### 1.5. APIs

```http
POST /registry/people/register
Content-Type: application/json

{
  "cpf": "123.456.789-00",
  "email": "maria@example.com",
  "name": "Maria Silva",
  "tenant_id": "tenant-abc"
}
```

**Resposta:**
```json
{
  "logline_id": "LL-BR-2024-MAR789",
  "created": true, // true = nova, false = vinculada
  "tenant_relationship": {
    "role": "customer",
    "tenant_id": "tenant-abc"
  }
}
```

```http
GET /registry/people/{logline_id}
```

```http
GET /registry/people/search?cpf=...&email=...&tenant_id=...
```

```http
GET /registry/people/{logline_id}/tenants
Authorization: Bearer <token>
```

---

## 📦 2. OBJETOS - Matéria Inanimada Rastreável

### 2.1. Conceito

**Filosofia:** Se não é pessoa, não é ideia, não é contrato = é objeto.

**Taxonomia:**
- Documentos Oficiais (RG, CNH, Alvará, Certidões)
- Arquivos (Files) - Contratos digitalizados, fotos, vídeos, PDFs
- Mercadorias - Produtos físicos comercializáveis
- Acervo - Livros, obras de arte, equipamentos compartilhados
- Lost & Found - Achados e perdidos
- Estoque - Instâncias físicas específicas

### 2.2. Schema

```sql
CREATE TABLE registry_objects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type     TEXT NOT NULL, -- 'document' | 'file' | 'merchandise' | 'collection' | 'lost_found' | 'inventory'
  tenant_id       UUID, -- NULL = cross-app (documento oficial)
  app_id          VARCHAR(255), -- App que criou (opcional)
  
  -- Identificação
  identifier      TEXT, -- SKU, código de barras, número oficial
  name            TEXT NOT NULL,
  description     TEXT,
  
  -- Dados específicos por tipo (JSONB flexível)
  metadata        JSONB, -- {
    -- document: { numero_oficial, orgao_emissor, validade, hash_arquivo }
    -- merchandise: { sku, codigo_barras, fornecedor_logline_id, categoria, preco_custo, preco_venda }
    -- inventory: { lote, data_fabricacao, data_validade, localizacao, unidades_disponiveis }
    -- collection: { localizacao_atual, responsavel_logline_id, historico_custodia, condicao_fisica }
  },
  
  -- Rastreabilidade
  owner_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
  current_custodian_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
  location        TEXT,
  
  -- Versionamento (para arquivos)
  version         INTEGER DEFAULT 1,
  parent_object_id UUID REFERENCES registry_objects(id), -- Para versões
  
  -- Lost & Found específico
  lost_found_status TEXT, -- 'lost' | 'found' | 'matched' | 'returned'
  lost_found_reported_by VARCHAR(50) REFERENCES core_people(logline_id),
  lost_found_match_score DECIMAL(5,2), -- ML matching score
  
  -- Visibilidade
  visibility      TEXT NOT NULL DEFAULT 'tenant', -- 'tenant' | 'org' | 'public'
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registry_objects_type ON registry_objects(object_type);
CREATE INDEX idx_registry_objects_tenant ON registry_objects(tenant_id);
CREATE INDEX idx_registry_objects_identifier ON registry_objects(identifier);
CREATE INDEX idx_registry_objects_owner ON registry_objects(owner_logline_id);
CREATE INDEX idx_registry_objects_custodian ON registry_objects(current_custodian_logline_id);
CREATE INDEX idx_registry_objects_lost_found ON registry_objects(lost_found_status) WHERE lost_found_status IS NOT NULL;

-- Histórico de Movimentação
CREATE TABLE registry_object_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id       UUID NOT NULL REFERENCES registry_objects(id),
  movement_type   TEXT NOT NULL, -- 'entry' | 'exit' | 'transfer' | 'adjustment'
  from_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
  to_logline_id   VARCHAR(50) REFERENCES core_people(logline_id),
  from_location   TEXT,
  to_location     TEXT,
  quantity        INTEGER,
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_object_movements_object ON registry_object_movements(object_id);
CREATE INDEX idx_object_movements_type ON registry_object_movements(movement_type);
```

### 2.3. APIs

```http
POST /registry/objects
Content-Type: application/json

{
  "object_type": "merchandise",
  "identifier": "DELL-INSP15-2024",
  "name": "Notebook Dell Inspiron 15",
  "metadata": {
    "sku": "DELL-INSP15-2024",
    "categoria": "Informática",
    "preco_custo": 2500,
    "preco_venda": 3500
  },
  "tenant_id": "tenant-abc",
  "visibility": "tenant"
}
```

```http
GET /registry/objects/{id}
```

```http
GET /registry/objects?object_type=merchandise&tenant_id=...&q=...
```

```http
PUT /registry/objects/{id}/transfer
Content-Type: application/json

{
  "to_logline_id": "LL-BR-2024-MAR789",
  "to_location": "Loja Centro",
  "reason": "Venda"
}
```

```http
POST /registry/objects/{id}/movements
Content-Type: application/json

{
  "movement_type": "exit",
  "quantity": 1,
  "reason": "Venda"
}
```

---

## 💡 3. IDEIAS - Democracia Orçamentária

### 3.1. Conceito

**Problema:** Tudo é "urgente", orçamento limitado, nada avança.

**Solução:** Sistema de votação colaborativa com prioridade consensual e matriz Custo x Prioridade.

### 3.2. Schema

```sql
CREATE TABLE registry_ideas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  app_id          VARCHAR(255), -- App que criou (opcional)
  
  -- Conteúdo
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  autor_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
  
  -- Priorização
  prioridade_autor INTEGER NOT NULL CHECK (prioridade_autor >= 1 AND prioridade_autor <= 10),
  prioridade_consensual DECIMAL(4,2), -- Calculada (média ponderada)
  
  -- Financeiro
  custo_estimado  DECIMAL(12,2),
  moeda           VARCHAR(3) DEFAULT 'BRL',
  
  -- Status
  status          TEXT NOT NULL DEFAULT 'aguardando_votos', 
  -- 'aguardando_votos' | 'em_votacao' | 'aprovada' | 'rejeitada' | 'adiada' | 'em_execucao' | 'concluida'
  
  -- Relacionamentos
  parent_idea_id  UUID REFERENCES registry_ideas(id), -- Para sub-ideias
  contract_id     UUID, -- Se virou contrato (FK para registry_contracts)
  
  -- Retrospectiva
  custo_real      DECIMAL(12,2),
  impacto_real    TEXT,
  aprendizados    TEXT,
  
  -- Configuração
  periodo_votacao_dias INTEGER DEFAULT 7,
  data_submissao  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_fim_votacao TIMESTAMPTZ,
  data_aprovacao  TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registry_ideas_tenant ON registry_ideas(tenant_id);
CREATE INDEX idx_registry_ideas_status ON registry_ideas(status);
CREATE INDEX idx_registry_ideas_prioridade ON registry_ideas(prioridade_consensual DESC NULLS LAST);
CREATE INDEX idx_registry_ideas_autor ON registry_ideas(autor_logline_id);

-- Votos
CREATE TABLE registry_idea_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id         UUID NOT NULL REFERENCES registry_ideas(id),
  voter_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
  prioridade      INTEGER NOT NULL CHECK (prioridade >= 1 AND prioridade <= 10),
  comentario      TEXT,
  peso            DECIMAL(3,2) DEFAULT 1.0, -- Para stakeholders com mais "skin in the game"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idea_id, voter_logline_id)
);

CREATE INDEX idx_idea_votes_idea ON registry_idea_votes(idea_id);
CREATE INDEX idx_idea_votes_voter ON registry_idea_votes(voter_logline_id);
```

### 3.3. APIs

```http
POST /registry/ideas
Content-Type: application/json

{
  "titulo": "Implementar CRM para vendas",
  "descricao": "Sistema para organizar leads e pipeline comercial",
  "prioridade_autor": 9,
  "custo_estimado": 15000,
  "tenant_id": "tenant-abc",
  "periodo_votacao_dias": 7
}
```

```http
POST /registry/ideas/{id}/vote
Content-Type: application/json

{
  "prioridade": 8,
  "comentario": "Urgente, perdemos vendas",
  "peso": 1.2 // Stakeholder com mais responsabilidade
}
```

```http
GET /registry/ideas?tenant_id=...&status=em_votacao&sort=prioridade_consensual
```

```http
GET /registry/ideas/{id}/matrix
// Retorna: Matriz Custo x Prioridade Consensual
```

```http
POST /registry/ideas/{id}/approve
// Aprova ideia, pode gerar contrato automaticamente
```

---

## 📄 4. CONTRATOS - Acordos Executáveis

### 4.1. Conceito

**Filosofia:** Contratos são **máquinas de estado** com comportamento determinístico.

**Estados:**
- `RASCUNHO` → `VIGENTE` → `QUESTIONADO` / `CONCLUÍDO` / `CANCELADO`
- `QUESTIONADO` → `PENALIZADO` (se justificativa rejeitada)

### 4.2. Schema

```sql
CREATE TABLE registry_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  app_id          VARCHAR(255), -- App que criou (opcional)
  
  -- Tipo
  tipo            TEXT NOT NULL, -- 'prestacao_servico' | 'compra_venda' | 'trabalho' | 'outro'
  
  -- Partes
  autor_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
  contraparte_logline_id VARCHAR(50) NOT NULL REFERENCES core_people(logline_id),
  testemunha_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
  
  -- Conteúdo
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  escopo          JSONB, -- Array de itens do escopo
  data_inicio     DATE,
  prazo_dias      INTEGER,
  data_limite     DATE,
  
  -- Financeiro
  valor_total     DECIMAL(12,2),
  moeda           VARCHAR(3) DEFAULT 'BRL',
  forma_pagamento TEXT,
  multa_atraso    JSONB, -- { tipo: 'percentual_dia', valor: 2 }
  
  -- Cláusulas
  clausulas       JSONB, -- {
    -- consequencia_normal: "...",
    -- possibilidades_questionamento: [...],
    -- penalidades: { atraso_injustificado: "...", nao_entrega: "...", qualidade_insatisfatoria: "..." }
  },
  
  -- Estado
  estado_atual    TEXT NOT NULL DEFAULT 'RASCUNHO',
  -- 'RASCUNHO' | 'VIGENTE' | 'QUESTIONADO' | 'CONCLUÍDO' | 'CANCELADO' | 'PENALIZADO'
  
  -- Relacionamentos
  idea_id         UUID REFERENCES registry_ideas(id), -- Se originou de uma ideia
  parent_contract_id UUID REFERENCES registry_contracts(id), -- Para aditivos
  
  -- Despacho
  despacho_tipo   TEXT, -- 'publico' | 'hierarquico' | 'automatizado'
  despacho_config JSONB, -- Configuração do despacho
  
  -- Questionamento
  questionamento_razao TEXT,
  questionamento_data TIMESTAMPTZ,
  periodo_defesa_dias INTEGER DEFAULT 3,
  justificativa   TEXT,
  justificativa_aceita BOOLEAN,
  
  -- Penalidade
  penalidade_aplicada DECIMAL(12,2),
  penalidade_data TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registry_contracts_tenant ON registry_contracts(tenant_id);
CREATE INDEX idx_registry_contracts_estado ON registry_contracts(estado_atual);
CREATE INDEX idx_registry_contracts_autor ON registry_contracts(autor_logline_id);
CREATE INDEX idx_registry_contracts_contraparte ON registry_contracts(contraparte_logline_id);

-- Histórico de Estados
CREATE TABLE registry_contract_state_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES registry_contracts(id),
  estado_anterior TEXT,
  estado_novo     TEXT NOT NULL,
  motivo          TEXT,
  changed_by_logline_id VARCHAR(50) REFERENCES core_people(logline_id),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contract_history_contract ON registry_contract_state_history(contract_id);
```

### 4.3. APIs

```http
POST /registry/contracts
Content-Type: application/json

{
  "tipo": "prestacao_servico",
  "titulo": "Desenvolvimento de Site Institucional",
  "autor_logline_id": "LL-BR-2024-EMPRESA",
  "contraparte_logline_id": "LL-BR-2024-FREELANCER",
  "conteudo": {
    "escopo": ["Homepage", "Sobre", "Contato", "Blog"],
    "data_inicio": "2024-12-01",
    "prazo_dias": 30
  },
  "financeiro": {
    "valor_total": 5000,
    "forma_pagamento": "50% início, 50% entrega",
    "multa_atraso": { "tipo": "percentual_dia", "valor": 2 }
  },
  "clausulas": { ... }
}
```

```http
POST /registry/contracts/{id}/sign
// Assina eletronicamente (RASCUNHO → VIGENTE)
```

```http
POST /registry/contracts/{id}/question
Content-Type: application/json

{
  "razao": "Prazo expirou, entrega não confirmada"
}
// VIGENTE → QUESTIONADO
```

```http
POST /registry/contracts/{id}/defend
Content-Type: application/json

{
  "justificativa": "Teve problema de saúde (anexa atestado)",
  "anexos": ["object-id-1", "object-id-2"]
}
```

```http
POST /registry/contracts/{id}/resolve
Content-Type: application/json

{
  "aceita_justificativa": false,
  "aplica_penalidade": true
}
// QUESTIONADO → PENALIZADO ou VIGENTE
```

```http
POST /registry/contracts/{id}/dispatch
Content-Type: application/json

{
  "tipo": "hierarquico",
  "config": {
    "nivel_1": "gestor_direto",
    "nivel_2": "diretoria",
    "nivel_3": "conselho"
  }
}
```

---

## 🔗 5. RELACIONAMENTOS ENTRE ENTIDADES

### 5.1. Schema de Relacionamentos

```sql
-- Relacionamentos genéricos entre entidades do Registry
CREATE TABLE registry_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type     TEXT NOT NULL, -- 'person' | 'object' | 'idea' | 'contract' | 'app'
  source_id       UUID NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       UUID NOT NULL,
  relationship_type TEXT NOT NULL, -- 'owns' | 'created' | 'references' | 'depends_on' | 'transforms_to'
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationships_source ON registry_relationships(source_type, source_id);
CREATE INDEX idx_relationships_target ON registry_relationships(target_type, target_id);
CREATE INDEX idx_relationships_type ON registry_relationships(relationship_type);
```

### 5.2. Exemplos de Relacionamentos

```
Pessoa → Objeto: "owns" (Maria possui Notebook)
Ideia → Contrato: "transforms_to" (Ideia aprovada vira Contrato)
Contrato → Objeto: "generates" (Contrato concluído gera Objeto no estoque)
Objeto → Pessoa: "transferred_to" (Objeto transferido para Pessoa)
```

---

## 🌐 6. APIs UNIFICADAS DO REGISTRY

### 6.1. Discovery Unificado

```http
GET /registry/search?type=person|object|idea|contract|app&q=...&tenant_id=...
```

### 6.2. Cross-References

```http
GET /registry/{type}/{id}/relationships
// Retorna todos os relacionamentos de uma entidade
```

### 6.3. Apps Participando

Apps podem criar/ler/atualizar entidades via APIs do Registry:

```http
POST /registry/people/register
X-App-ID: app-ticket-triage
// App cria pessoa ao cadastrar cliente
```

```http
POST /registry/objects
X-App-ID: app-marketplace
// App cria objeto (mercadoria) ao cadastrar produto
```

---

## 📊 7. VISUALIZAÇÕES ESTRATÉGICAS

### 7.1. Dashboard de Ideias

- Matriz Custo x Prioridade Consensual
- Pipeline de orçamento
- Quick Wins vs Investimentos Estratégicos

### 7.2. Dashboard de Contratos

- Contratos por estado
- Penalidades aplicadas
- Tempo médio de execução

### 7.3. Dashboard de Objetos

- Rastreabilidade completa
- Lost & Found matching
- Movimentações recentes

---

## 🔐 8. SEGURANÇA E PERMISSÕES

### 8.1. Níveis de Acesso

1. **Tenant Isolation** - Dados isolados por tenant
2. **Role-Based Access** - Admin vs User vs Guest
3. **Object-Level** - Permissões por entidade
4. **Field-Level** - Campos sensíveis (CPF, etc.)

### 8.2. Apps e Permissões

Apps devem declarar permissões no manifest:
```json
{
  "scopes": {
    "registry": {
      "people": ["read", "create"],
      "objects": ["read", "create", "update"],
      "ideas": ["read"],
      "contracts": ["read", "create"]
    }
  }
}
```

---

## 🚀 9. IMPLEMENTAÇÃO

### Phase 5.1: Registry Core (Pessoas + Objetos)
### Phase 5.2: Registry Ideias + Contratos
### Phase 5.3: Registry Apps (Marketplace)
### Phase 5.4: Relacionamentos e Workflows

---

**Status:** Aguardando aprovação para integração completa no blueprint.

