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
