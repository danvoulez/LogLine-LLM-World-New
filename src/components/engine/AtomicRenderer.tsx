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
