'use client';

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowUp, Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface OmniBarProps {
  onSubmit: (value: string) => void;
  isThinking?: boolean;
}

export function OmniBar({ onSubmit, isThinking = false }: OmniBarProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
    inputRef.current?.blur();
  };

  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <motion.div
        layout
        initial={false}
        animate={{
          width: isFocused || input ? "100%" : "420px",
          maxWidth: "680px",
        }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "pointer-events-auto relative group",
          "bg-white/80 backdrop-blur-xl border border-white/20",
          "shadow-2xl shadow-blue-900/5 rounded-full",
          "flex items-center gap-2 p-2",
          isThinking && "ring-2 ring-blue-500/20"
        )}
      >
        {/* The Brain Icon / Status Indicator */}
        <div className="pl-3 flex items-center justify-center">
          {isThinking ? (
            <div className="relative flex items-center justify-center">
              <div className="absolute h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <Sparkles className="h-5 w-5 text-blue-600 relative z-10 animate-pulse" />
            </div>
          ) : (
            <div className="bg-gray-100 p-2 rounded-full">
              <Command className="h-4 w-4 text-gray-500" />
            </div>
          )}
        </div>

        {/* The Input Field */}
        <form onSubmit={handleSubmit} className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isThinking ? "LogLine is designing..." : "Ask anything (e.g. 'Analyze Costs')..."}
            disabled={isThinking}
            className="w-full bg-transparent border-none focus:ring-0 text-gray-800 placeholder-gray-400 text-base font-medium py-3"
          />
        </form>

        {/* The Action Button */}
        <AnimatePresence mode="popLayout">
          {(input || isThinking) && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isThinking}
              className="bg-black text-white p-3 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={3} />
            </motion.button>
          )}
        </AnimatePresence>
        
        {/* Ambient Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
      </motion.div>
    </div>
  );
}

