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
  type: 'Card' | 'Metric' | 'TraceRibbon' | 'ChatBubble' | 'ToolOutput' | 'PolicyBadge' | 'Table' | 'Chart' | 'Badge' | 'Button' | 'Input' | 'Text';
  props: Record<string, any>;
  children?: AtomicComponent[];
  animation_delay?: number;
}
