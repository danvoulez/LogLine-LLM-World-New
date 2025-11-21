'use client';

import { useState, useEffect } from "react";
import { AtomicRenderer } from "@/components/engine/AtomicRenderer";
import { fetchLayoutForIntent } from "@/lib/api/client";
import { UILayout } from "@/types/atomic";
import { OmniBar } from "@/components/safe/OmniBar";
import { RegisterSW } from "@/app/register-sw";

export default function AgentOS() {
  const [layout, setLayout] = useState<UILayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // fetchLayoutForIntent already handles errors internally and falls back to mock
      const result = await fetchLayoutForIntent(prompt);
      setLayout(result);
      // Clear any previous errors if we got a result (even if it's mock data)
      setError(null);
    } catch (err) {
      // This should rarely happen since fetchLayoutForIntent has internal error handling
      const errorMessage = err instanceof Error ? err.message : 'Failed to load layout';
      setError(errorMessage);
      console.error('Error executing prompt:', err);
      // Still try to show mock layout as fallback
      try {
        const mockResult = await fetchLayoutForIntent(prompt);
        setLayout(mockResult);
      } catch (mockErr) {
        console.error('Even mock layout failed:', mockErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load with default prompt
  useEffect(() => {
    handleExecute("Show me the system status");
  }, []);

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-gray-900 font-sans relative pb-32">
      
      {/* THE CANVAS (Where the mountain appears) */}
      <div className="max-w-5xl mx-auto w-full p-6 md:pt-20 space-y-6">
        
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <div className="relative z-10 h-8 w-8 rounded-full bg-blue-500" />
              </div>
              <p className="text-sm text-gray-500">Generating layout...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Empty State - Beautiful Nothing */}
        {!layout && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 opacity-40">
            <h1 className="text-4xl font-bold tracking-tighter text-gray-300">LogLine OS</h1>
            <p className="text-gray-400">Ready to construct.</p>
          </div>
        )}

        {/* The Rendered UI */}
        {layout && !loading && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex items-baseline justify-between pb-6 border-b border-gray-200">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{layout.title}</h1>
              <span className="font-mono text-xs text-gray-400 uppercase tracking-widest">Generated via TDLN</span>
            </header>
            
            {layout.components.map((comp) => (
              <AtomicRenderer key={comp.id} component={comp} />
            ))}
          </div>
        )}
      </div>

      {/* THE FLOATING BRAIN */}
      <OmniBar onSubmit={handleExecute} isThinking={loading} />

      {/* Register Service Worker */}
      <RegisterSW />
    </main>
  );
}
