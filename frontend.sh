

```bash
#!/bin/bash

# LOGLINE UNIVERSAL FRONTEND - INSTALLER
# Stack: Next.js 14 (App Router), Tailwind, Framer Motion, Lucide Icons
# Architecture: Atomic Rendering Engine

echo "🏔️  Initializing LogLine Agent OS Frontend..."

# 1. Create Next.js App
npx create-next-app@latest logline-ui \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm \
  --no-git 

cd logline-ui

# 2. Install Dependencies
echo "📦 Installing Cinematic Engines..."
npm install framer-motion lucide-react clsx tailwind-merge date-fns

# 3. Create Folder Structure
mkdir -p src/components/engine
mkdir -p src/components/safe
mkdir -p src/lib/api
mkdir -p src/types

# ==========================================
# LAYER 1: THE TYPE SYSTEM (Contract with Backend)
# ==========================================

cat << 'EOF' > src/types/atomic.ts
// This matches your backend's JSON✯Atomic output
export type AtomicEventType = 
  | 'run_started' | 'run_completed' | 'step_started' 
  | 'tool_call' | 'llm_call' | 'policy_eval' | 'error';

export interface AtomicEvent {
  id: string;
  kind: AtomicEventType;
  payload: any;
  ts: string;
  trace_id?: string;
}

// The "Blueprint" the Backend sends to the Frontend
export interface UILayout {
  view_id: string;
  title: string;
  layout_type: 'ribbon' | 'dashboard' | 'document' | 'chat';
  components: AtomicComponent[];
}

export interface AtomicComponent {
  id: string;
  type: 'Card' | 'Metric' | 'TraceRibbon' | 'ChatBubble' | 'ToolOutput' | 'PolicyBadge';
  props: Record<string, any>;
  children?: AtomicComponent[];
  animation_delay?: number;
}
EOF

# ==========================================
# LAYER 2: THE SAFE COMPONENT LIBRARY
# "The Bricks" - Dumb, beautiful, stateless components
# ==========================================

cat << 'EOF' > src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

# 1. SafeCard (The container)
cat << 'EOF' > src/components/safe/SafeCard.tsx
import { cn } from "@/lib/utils";

export function SafeCard({ title, children, className, variant = "default" }: any) {
  const variants = {
    default: "bg-white border border-gray-200 shadow-sm",
    glass: "bg-white/80 backdrop-blur-md border border-white/20 shadow-lg",
    error: "bg-red-50 border border-red-200",
    success: "bg-green-50 border border-green-200"
  };

  return (
    <div className={cn("rounded-xl p-5 transition-all", variants[variant as keyof typeof variants], className)}>
      {title && <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</h3>}
      <div className="space-y-2">{children}</div>
    </div>
  );
}
EOF

# 2. SafeMetric (For Dashboarding)
cat << 'EOF' > src/components/safe/SafeMetric.tsx
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function SafeMetric({ label, value, trend, trendValue }: any) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {trend && (
          <span className={`flex items-center text-xs font-bold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
EOF

# 3. TraceRibbon (The "Cinematic" Execution View)
cat << 'EOF' > src/components/safe/TraceRibbon.tsx
import { motion } from "framer-motion";
import { Bot, Terminal, ShieldAlert, CheckCircle, Zap } from "lucide-react";

const icons = {
  run_started: Zap,
  tool_call: Terminal,
  llm_call: Bot,
  policy_eval: ShieldAlert,
  run_completed: CheckCircle,
};

export function TraceRibbon({ events }: { events: any[] }) {
  return (
    <div className="relative border-l-2 border-gray-100 ml-4 space-y-8 py-4">
      {events.map((event, i) => {
        const Icon = icons[event.kind as keyof typeof icons] || Zap;
        return (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative pl-8"
          >
            <div className="absolute -left-[9px] top-0 bg-white p-1 rounded-full border border-gray-200">
              <Icon className="w-4 h-4 text-gray-500" />
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start">
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">{event.kind}</span>
                <span className="text-[10px] text-gray-400">{new Date(event.ts).toLocaleTimeString()}</span>
              </div>
              <div className="mt-2 text-sm text-gray-700 font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(event.payload, null, 2).slice(0, 150)}
                {JSON.stringify(event.payload).length > 150 && "..."}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  );
}
EOF

# ==========================================
# LAYER 3: THE RENDERING ENGINE
# "The Brain" - Maps JSON to Components
# ==========================================

cat << 'EOF' > src/components/engine/AtomicRenderer.tsx
'use client';

import { motion } from "framer-motion";
import { SafeCard } from "../safe/SafeCard";
import { SafeMetric } from "../safe/SafeMetric";
import { TraceRibbon } from "../safe/TraceRibbon";
import { AtomicComponent } from "@/types/atomic";

// 1. The Registry of Safe Components
const COMPONENT_REGISTRY: Record<string, any> = {
  Card: SafeCard,
  Metric: SafeMetric,
  TraceRibbon: TraceRibbon,
  // Add more here (Charts, Tables, etc.)
};

export function AtomicRenderer({ component }: { component: AtomicComponent }) {
  const Component = COMPONENT_REGISTRY[component.type];

  if (!Component) {
    console.warn(`Unknown component type: ${component.type}`);
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (component.animation_delay || 0) * 0.1 }}
      className="w-full"
    >
      <Component {...component.props}>
        {/* Recursive Rendering for Children */}
        {component.children?.map((child) => (
          <AtomicRenderer key={child.id} component={child} />
        ))}
      </Component>
    </motion.div>
  );
}
EOF

# ==========================================
# LAYER 4: THE API BRIDGE (Mocked for Demo)
# Connects to your NestJS Backend
# ==========================================

cat << 'EOF' > src/lib/api/client.ts
import { UILayout } from "@/types/atomic";

// In production, this fetches from your NestJS /api/v1/render endpoint
// which uses TDLN-T to generate this JSON structure based on the user prompt.

export async function fetchLayoutForIntent(intent: string): Promise<UILayout> {
  // MOCK: Simulating TDLN-T Logic on the backend
  // If intent contains "trace" or "debug", return ribbon view.
  // If intent contains "status" or "overview", return dashboard.
  
  await new Promise(resolve => setTimeout(resolve, 600)); // Network latency simulation

  if (intent.includes("debug") || intent.includes("trace")) {
    return {
      view_id: "trace_view_01",
      title: "Execution Trace Ribbon",
      layout_type: "ribbon",
      components: [
        {
          id: "c1", type: "Card", props: { title: "Live Execution Stream", variant: "glass" },
          children: [
            { 
              id: "t1", type: "TraceRibbon", 
              props: { 
                events: [
                  { id: "1", kind: "run_started", payload: { workflow: "ticket_triage" }, ts: new Date().toISOString() },
                  { id: "2", kind: "step_started", payload: { step: "fetch_emails" }, ts: new Date().toISOString() },
                  { id: "3", kind: "tool_call", payload: { tool: "gmail_api", query: "in:inbox" }, ts: new Date().toISOString() },
                  { id: "4", kind: "llm_call", payload: { model: "gpt-4o", reasoning: "Found 3 urgent emails." }, ts: new Date().toISOString() },
                ] 
              } 
            }
          ]
        }
      ]
    };
  }

  // Default: Dashboard
  return {
    view_id: "dash_01",
    title: "Agent Overview",
    layout_type: "dashboard",
    components: [
      {
        id: "grid", type: "Card", props: { className: "grid grid-cols-1 md:grid-cols-3 gap-4 bg-transparent border-none shadow-none p-0" },
        children: [
          { id: "m1", type: "Card", props: {}, children: [{ id: "mv1", type: "Metric", props: { label: "Active Agents", value: "12", trend: "up", trendValue: "+2" } }] },
          { id: "m2", type: "Card", props: {}, children: [{ id: "mv2", type: "Metric", props: { label: "Total Tokens", value: "1.2M", trend: "up", trendValue: "+15%" } }] },
          { id: "m3", type: "Card", props: {}, children: [{ id: "mv3", type: "Metric", props: { label: "Cost (Today)", value: "$4.20", trend: "down", trendValue: "-5%" } }] },
        ]
      },
      {
        id: "main_area", type: "Card", props: { title: "Recent Activity" },
        children: [
           { 
              id: "t2", type: "TraceRibbon", 
              props: { 
                events: [
                   { id: "5", kind: "policy_eval", payload: { decision: "allow", rule: "budget_check" }, ts: new Date().toISOString() }
                ] 
              } 
            }
        ]
      }
    ]
  };
}
EOF

# ==========================================
# LAYER 5: THE PAGE (The "OS" Shell)
# ==========================================

cat << 'EOF' > src/app/page.tsx
'use client';

import { useState, useEffect } from "react";
import { AtomicRenderer } from "@/components/engine/AtomicRenderer";
import { fetchLayoutForIntent } from "@/lib/api/client";
import { UILayout } from "@/types/atomic";
import { Command, Sparkles } from "lucide-react";

export default function AgentOS() {
  const [prompt, setPrompt] = useState("Show me the system status");
  const [layout, setLayout] = useState<UILayout | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    // In real app: POST to /api/v1/render with prompt
    const result = await fetchLayoutForIntent(prompt);
    setLayout(result);
    setLoading(false);
  };

  // Initial Load
  useEffect(() => { handleExecute(); }, []);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Top Bar (Omnibox) */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Command className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            className="w-full pl-11 pr-4 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-0 rounded-xl transition-all shadow-sm text-sm"
            placeholder="Ask LogLine anything (e.g., 'Debug last run', 'Show costs')..."
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            <button 
              onClick={handleExecute}
              disabled={loading}
              className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Canvas */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
        {layout && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">{layout.title}</h2>
              <span className="text-xs font-mono text-gray-400 px-2 py-1 bg-gray-100 rounded">View ID: {layout.view_id}</span>
            </div>
            
            {/* The Rendering Engine kicks in here */}
            {layout.components.map((comp) => (
              <AtomicRenderer key={comp.id} component={comp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
EOF

# Cleanup default CSS
echo "@tailwind base; @tailwind components; @tailwind utilities;" > src/app/globals.css

echo "✅ LogLine Frontend Scaffolded!"
echo "👉 Run: cd logline-ui && npm run dev"
```

### How this connects to your Backend

1.  **The TDLN-T connection:**
    In `src/lib/api/client.ts`, you see the `fetchLayoutForIntent` function.
    *   Currently, it mocks the response.
    *   **To integrate:** You replace the mock with a `fetch` to your NestJS backend endpoint (e.g., `/api/v1/render`).
    *   Your backend `TdlnTService` interprets the natural language ("Show me the trace") and constructs the `UILayout` JSON using the `JSON✯Atomic` schema you already implemented.

2.  **The Atomic Renderer (`src/components/engine/AtomicRenderer.tsx`):**
    *   This is the "White Skeleton" logic. It receives a JSON tree and recursively renders React components.
    *   It doesn't care *what* page it is. It just renders `Card`, then `Metric`, then `TraceRibbon` as instructed by the backend.

3.  **Safe Components (`src/components/safe/`):**
    *   `TraceRibbon`: Specifically designed to handle the `events` table format from your PostgreSQL DB.
    *   `SafeCard`: A generic container.
    *   `SafeMetric`: For your analytics endpoints.

### Why this is "Revolutionary"

*   **Zero-Code Dashboards:** You don't write a "Dashboard.tsx" or "Trace.tsx". The Backend *invents* the UI structure based on the data shape.
*   **Cinematic:** Framer Motion is baked into the renderer. Elements slide in (`animation_delay`) creating a high-end "OS" feel.
*   **Adaptive:** If you add a new metric to the backend, the frontend visualizes it automatically without a deployment.

Run the script, `npm run dev`, and type "debug" or "status" in the search bar to see the UI morph instantly.