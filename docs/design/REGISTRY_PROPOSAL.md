# 📦 Registry Centralizado - Proposta

**Data:** 2024-12-19  
**Status:** Proposta  
**Prioridade:** Alta (gap crítico para ecossistema)

---

## 🎯 Problema Identificado

O sistema atual tem:
- ✅ Apps com `visibility` (`private`, `org`, `public`)
- ✅ Registry interno (metadata store)
- ❌ **Falta Registry centralizado** para descoberta e compartilhamento

**Gap:** Não há como:
- Descobrir apps públicos
- Compartilhar apps entre tenants/orgs
- Instalar apps de terceiros
- Versionar apps compartilhados
- Gerenciar dependências entre apps

---

## 💡 Proposta: Registry Centralizado

### 1. Conceito

Um **Registry** é um repositório centralizado onde:
- Apps públicos podem ser descobertos
- Tools podem ser compartilhados
- Agents podem ser compartilhados
- Workflows podem ser compartilhados (futuro)

### 2. Namespace Público

**Formato:** `@owner/app-id`

**Exemplos:**
- `@logline/ticket-triage` - App oficial do LogLine
- `@acme/support-console` - App da empresa Acme
- `@community/weather-bot` - App da comunidade

### 3. Versionamento

Apps no registry devem ter versões semânticas:
- `@logline/ticket-triage@1.0.0`
- `@logline/ticket-triage@1.1.0`
- `@logline/ticket-triage@2.0.0`

### 4. Visibilidade

- **`private`** - Apenas tenant/org (atual)
- **`org`** - Compartilhado na organização (atual)
- **`public`** - Disponível no registry público (novo)

---

## 🏗️ Arquitetura Proposta

### 4.1. Schema Adicional

```sql
-- Registry de Apps
CREATE TABLE registry_apps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       TEXT NOT NULL, -- '@owner/app-id'
  version         TEXT NOT NULL, -- '1.0.0'
  app_id          VARCHAR(255) NOT NULL, -- ID do app original
  manifest        JSONB NOT NULL, -- Manifest completo
  owner_id        UUID NOT NULL, -- User/org que publicou
  tenant_id       UUID, -- Tenant de origem (opcional)
  visibility      TEXT NOT NULL DEFAULT 'public', -- 'public' | 'org'
  downloads       INTEGER NOT NULL DEFAULT 0,
  rating          DECIMAL(3,2), -- 0.00 a 5.00
  rating_count    INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  readme          TEXT, -- Markdown README
  tags            TEXT[], -- ['support', 'triage', 'automation']
  dependencies    JSONB, -- [{namespace: '@logline/core-tools', version: '^1.0.0'}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  UNIQUE(namespace, version)
);

CREATE INDEX idx_registry_apps_namespace ON registry_apps(namespace);
CREATE INDEX idx_registry_apps_visibility ON registry_apps(visibility);
CREATE INDEX idx_registry_apps_tags ON registry_apps USING GIN(tags);
CREATE INDEX idx_registry_apps_rating ON registry_apps(rating DESC);

-- Reviews/Ratings
CREATE TABLE registry_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_app_id UUID NOT NULL REFERENCES registry_apps(id),
  user_id         UUID NOT NULL,
  tenant_id       UUID,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(registry_app_id, user_id)
);

-- Instalações
CREATE TABLE registry_installations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_app_id UUID NOT NULL REFERENCES registry_apps(id),
  installed_app_id VARCHAR(255) NOT NULL, -- ID do app instalado no tenant
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL, -- Quem instalou
  version         TEXT NOT NULL,
  installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registry_installations_tenant ON registry_installations(tenant_id);
CREATE INDEX idx_registry_installations_registry_app ON registry_installations(registry_app_id);
```

### 4.2. Endpoints Propostos

#### Discovery

```http
GET /registry/apps
```

**Query Params:**
- `q` - Busca por nome/descrição
- `owner` - Filtrar por owner (`@logline`, `@acme`)
- `tags` - Filtrar por tags (`?tags=support,triage`)
- `min_rating` - Rating mínimo (1-5)
- `sort` - Ordenar (`rating`, `downloads`, `updated_at`, `created_at`)
- `limit` - Limite (default: 20)
- `offset` - Paginação

**Resposta:**
```json
{
  "apps": [
    {
      "namespace": "@logline/ticket-triage",
      "version": "1.2.0",
      "name": "Ticket Triage",
      "description": "AI-powered ticket triage system",
      "owner": "logline",
      "rating": 4.5,
      "rating_count": 42,
      "downloads": 1234,
      "tags": ["support", "triage", "automation"],
      "icon": "🎫",
      "published_at": "2024-12-01T10:00:00Z"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

#### Obter App do Registry

```http
GET /registry/apps/:namespace
```

**Query Params:**
- `version` - Versão específica (default: latest)

**Resposta:**
```json
{
  "namespace": "@logline/ticket-triage",
  "version": "1.2.0",
  "manifest": { ... }, // Manifest completo
  "readme": "# Ticket Triage\n\n...",
  "dependencies": [
    {
      "namespace": "@logline/core-tools",
      "version": "^1.0.0"
    }
  ],
  "rating": 4.5,
  "rating_count": 42,
  "downloads": 1234,
  "tags": ["support", "triage"],
  "published_at": "2024-12-01T10:00:00Z"
}
```

#### Publicar App

```http
POST /registry/apps
Authorization: Bearer <token>
Content-Type: application/json

{
  "namespace": "@logline/ticket-triage",
  "version": "1.2.0",
  "app_id": "ticket-triage", // ID do app local
  "description": "AI-powered ticket triage system",
  "readme": "# Ticket Triage\n\n...",
  "tags": ["support", "triage", "automation"],
  "dependencies": [
    {
      "namespace": "@logline/core-tools",
      "version": "^1.0.0"
    }
  ],
  "visibility": "public"
}
```

**Validações:**
- Namespace deve seguir formato `@owner/app-id`
- Owner deve corresponder ao usuário/org autenticado
- App deve existir localmente
- Manifest deve ser válido
- Dependências devem existir no registry

#### Instalar App

```http
POST /registry/apps/:namespace/install
Authorization: Bearer <token>
Content-Type: application/json

{
  "version": "1.2.0", // opcional, default: latest
  "target_app_id": "my-ticket-triage", // ID local (opcional)
  "tenant_id": "tenant-abc"
}
```

**Processo:**
1. Busca app no registry
2. Resolve dependências
3. Importa manifest via `POST /apps/import`
4. Cria registro em `registry_installations`
5. Retorna app instalado

**Resposta:**
```json
{
  "installed_app_id": "my-ticket-triage",
  "namespace": "@logline/ticket-triage",
  "version": "1.2.0",
  "installed_at": "2024-12-19T10:00:00Z"
}
```

#### Atualizar App Instalado

```http
PATCH /registry/apps/:namespace/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "version": "1.3.0",
  "target_app_id": "my-ticket-triage"
}
```

#### Desinstalar App

```http
DELETE /registry/apps/:namespace/uninstall
Authorization: Bearer <token>

{
  "target_app_id": "my-ticket-triage"
}
```

#### Reviews

```http
POST /registry/apps/:namespace/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "review": "Great app! Very useful for ticket triage."
}
```

```http
GET /registry/apps/:namespace/reviews
```

---

## 🔄 Fluxo de Uso

### 1. Publicar App

```
Developer → POST /registry/apps
  → Valida manifest
  → Cria entrada em registry_apps
  → App disponível no registry público
```

### 2. Descobrir Apps

```
User → GET /registry/apps?q=ticket&tags=support
  → Lista apps públicos
  → Filtra por busca/tags
```

### 3. Instalar App

```
User → POST /registry/apps/@logline/ticket-triage/install
  → Resolve dependências
  → POST /apps/import (manifest)
  → Cria registry_installation
  → App disponível no tenant
```

### 4. Atualizar App

```
User → PATCH /registry/apps/@logline/ticket-triage/update
  → Busca nova versão
  → Atualiza manifest
  → Atualiza registry_installation
```

---

## 🎯 Benefícios

1. **Ecossistema** - Apps podem ser compartilhados e descobertos
2. **Reutilização** - Evita recriar apps similares
3. **Colaboração** - Comunidade pode contribuir
4. **Versionamento** - Controle de versões semânticas
5. **Dependências** - Apps podem depender de outros apps/tools
6. **Qualidade** - Ratings e reviews ajudam a encontrar bons apps

---

## 🚀 Implementação Sugerida

### Phase 5: Registry Centralizado

**Prioridade:** Alta

**Tarefas:**
1. ✅ Adicionar schema (registry_apps, registry_reviews, registry_installations)
2. ✅ Criar RegistryController com endpoints de discovery
3. ✅ Criar RegistryService para publicar/instalar/atualizar
4. ✅ Integrar com AppsImportService
5. ✅ Adicionar validação de namespace
6. ✅ Adicionar resolução de dependências
7. ✅ Adicionar reviews/ratings
8. ✅ Adicionar busca e filtros
9. ✅ Adicionar testes

**Estimativa:** 2-3 semanas

---

## 📝 Notas de Design

### Namespace Format

- **Formato:** `@owner/app-id`
- **Owner:** Pode ser username, org name, ou "community"
- **App ID:** URL-friendly (kebab-case)
- **Exemplos válidos:**
  - `@logline/ticket-triage`
  - `@acme/support-console`
  - `@community/weather-bot`

### Versionamento

- **Semantic Versioning:** `MAJOR.MINOR.PATCH`
- **Latest:** Última versão publicada
- **Stable:** Última versão estável (sem pre-release)

### Dependências

```json
{
  "dependencies": [
    {
      "namespace": "@logline/core-tools",
      "version": "^1.0.0" // Semver range
    },
    {
      "namespace": "@acme/shared-workflows",
      "version": "~2.1.0"
    }
  ]
}
```

### Segurança

- ✅ Apenas owner pode publicar/atualizar
- ✅ Validação de manifest antes de publicar
- ✅ Validação de dependências
- ✅ Rate limiting em publicações
- ✅ Moderação (futuro)

---

## 🔮 Futuro

### Registry de Tools

```http
GET /registry/tools
POST /registry/tools/:namespace/install
```

### Registry de Agents

```http
GET /registry/agents
POST /registry/agents/:namespace/install
```

### Registry de Workflows

```http
GET /registry/workflows
POST /registry/workflows/:namespace/install
```

### Marketplace UI

- Interface web para descobrir apps
- Categorias e tags
- Screenshots e demos
- Analytics de uso

---

**Status:** Aguardando aprovação para adicionar ao blueprint e implementar.

