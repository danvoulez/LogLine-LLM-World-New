import { UILayout } from "@/types/atomic";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://log-line-llm-world-new.vercel.app';

/**
 * Fetches UI layout from backend based on natural language intent
 * Uses TDLN-T + LLM to generate JSON✯Atomic layout structure
 */
// Flag to track if we're using mock data (for UI indication)
let isUsingMockData = false;

export function isCurrentlyUsingMockData(): boolean {
  return isUsingMockData;
}

export async function fetchLayoutForIntent(intent: string): Promise<UILayout> {
  isUsingMockData = false; // Reset flag
  
  try {
    // Try to call backend render endpoint (if it exists)
    const response = await fetch(`${BACKEND_URL}/api/v1/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ prompt: intent }),
      // Add credentials for CORS if needed
      credentials: 'omit',
    });

    if (response.ok) {
      const data = await response.json();
      if (data.layout) {
        isUsingMockData = false;
        return data.layout as UILayout;
      }
      // If response doesn't have layout, fallback
      console.warn('Backend response missing layout field, using mock data');
      isUsingMockData = true;
      return getMockLayout(intent);
    }

    // If response is not ok, log and fallback
    const errorText = await response.text();
    console.warn(`Backend render endpoint returned ${response.status}: ${errorText.substring(0, 100)}`);
    isUsingMockData = true;
    return getMockLayout(intent);
  } catch (error) {
    // Network error or CORS issue
    console.error('Error fetching layout from backend:', error);
    console.warn('Falling back to mock data. Backend may be unreachable or CORS blocked.');
    isUsingMockData = true;
    // Fallback to mock data on error
    return getMockLayout(intent);
  }
}

/**
 * Mock layout generator (temporary until backend endpoint is ready)
 */
function getMockLayout(intent: string): UILayout {
  // Simulate network latency
  // await new Promise(resolve => setTimeout(resolve, 600));

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
