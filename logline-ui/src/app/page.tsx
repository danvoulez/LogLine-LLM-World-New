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
