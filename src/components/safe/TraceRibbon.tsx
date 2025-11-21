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
