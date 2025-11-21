# 🏔️ LogLine Agent OS - Frontend

**Atomic Rendering Engine** - Frontend que renderiza UI baseado em JSON do backend.

## 🚀 Quick Start

```bash
# Instalar dependências (já feito pelo script)
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar produção
npm start
```

Acesse: http://localhost:3000

## 🎯 Como Funciona

### Arquitetura em 5 Camadas

1. **Type System** (`src/types/atomic.ts`)
   - Contrato com o backend (JSON✯Atomic)
   - Define `UILayout` e `AtomicComponent`

2. **Safe Components** (`src/components/safe/`)
   - Componentes "burros" e bonitos
   - `SafeCard`, `SafeMetric`, `TraceRibbon`

3. **Rendering Engine** (`src/components/engine/AtomicRenderer.tsx`)
   - Mapeia JSON → Componentes React
   - Renderização recursiva

4. **API Bridge** (`src/lib/api/client.ts`)
   - Conecta com backend NestJS
   - Atualmente mockado (substituir por fetch real)

5. **OS Shell** (`src/app/page.tsx`)
   - Interface principal
   - Omnibox para comandos

## 🔌 Integração com Backend

### Atual (Mockado)

O arquivo `src/lib/api/client.ts` está mockado. Para conectar com o backend real:

```typescript
export async function fetchLayoutForIntent(intent: string): Promise<UILayout> {
  const response = await fetch('https://log-line-llm-world-new.vercel.app/api/v1/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: intent })
  });
  
  return response.json();
}
```

### Endpoint do Backend (a implementar)

O backend precisa ter um endpoint `/api/v1/render` que:
1. Recebe `{ prompt: string }`
2. Usa `TdlnTService` para interpretar
3. Retorna `UILayout` (JSON✯Atomic)

## 🎨 Componentes Disponíveis

- **Card**: Container genérico
- **Metric**: Métricas com trend
- **TraceRibbon**: Visualização de execução (cinemática)

## 🧪 Testar

1. Digite "debug" ou "trace" → Mostra TraceRibbon
2. Digite "status" ou "overview" → Mostra Dashboard
3. Digite qualquer coisa → Mostra Dashboard padrão

## 📦 Dependências

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS**
- **Framer Motion** (animações)
- **Lucide React** (ícones)
- **clsx** + **tailwind-merge** (utils)

## 🚀 Deploy

```bash
# Vercel (recomendado)
vercel

# Ou build manual
npm run build
npm start
```

---

**Criado por:** `setup-frontend.sh`  
**Arquitetura:** Atomic Rendering Engine (JSON✯Atomic)
