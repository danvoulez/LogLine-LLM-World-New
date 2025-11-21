import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): { message: string; version: string; api: string } {
    return {
      message: 'LogLine LLM World API',
      version: '1.0.0',
      api: '/api/v1',
    };
  }

  @Get('healthz')
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    database: string;
    uptime: number;
  }> {
    const startTime = process.uptime();
    let dbStatus = 'disconnected';

    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'connected';
      }
    } catch (error) {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: Math.floor(startTime),
    };
  }

  /**
   * Render endpoint: Generates UI layout from natural language prompt
   * Uses TDLN-T + LLM to create JSON✯Atomic layout structure
   * 
   * TODO: Implement full TDLN-T + LLM integration for dynamic layout generation
   * For now, returns mock data based on prompt keywords
   */
  @Post('api/v1/render')
  async renderLayout(@Body() body: { prompt: string }): Promise<{ layout: any }> {
    const { prompt } = body;

    // TODO: Use TDLN-T to structure the prompt, then LLM to generate layout
    // For now, return mock layout based on keywords
    const layout = this.generateMockLayout(prompt);

    return { layout };
  }

  private generateMockLayout(prompt: string): any {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('debug') || lowerPrompt.includes('trace')) {
      return {
        view_id: 'trace_view_01',
        title: 'Execution Trace Ribbon',
        layout_type: 'ribbon',
        components: [
          {
            id: 'c1',
            type: 'Card',
            props: { title: 'Live Execution Stream', variant: 'glass' },
            children: [
              {
                id: 't1',
                type: 'TraceRibbon',
                props: {
                  events: [
                    { id: '1', kind: 'run_started', payload: { workflow: 'ticket_triage' }, ts: new Date().toISOString() },
                    { id: '2', kind: 'step_started', payload: { step: 'fetch_emails' }, ts: new Date().toISOString() },
                    { id: '3', kind: 'tool_call', payload: { tool: 'gmail_api', query: 'in:inbox' }, ts: new Date().toISOString() },
                    { id: '4', kind: 'llm_call', payload: { model: 'gpt-4o', reasoning: 'Found 3 urgent emails.' }, ts: new Date().toISOString() },
                  ],
                },
              },
            ],
          },
        ],
      };
    }

    // Default: Dashboard
    return {
      view_id: 'dash_01',
      title: 'Agent Overview',
      layout_type: 'dashboard',
      components: [
        {
          id: 'grid',
          type: 'Card',
          props: { className: 'grid grid-cols-1 md:grid-cols-3 gap-4 bg-transparent border-none shadow-none p-0' },
          children: [
            {
              id: 'm1',
              type: 'Card',
              props: {},
              children: [{ id: 'mv1', type: 'Metric', props: { label: 'Active Agents', value: '12', trend: 'up', trendValue: '+2' } }],
            },
            {
              id: 'm2',
              type: 'Card',
              props: {},
              children: [{ id: 'mv2', type: 'Metric', props: { label: 'Total Tokens', value: '1.2M', trend: 'up', trendValue: '+15%' } }],
            },
            {
              id: 'm3',
              type: 'Card',
              props: {},
              children: [{ id: 'mv3', type: 'Metric', props: { label: 'Cost (Today)', value: '$4.20', trend: 'down', trendValue: '-5%' } }],
            },
          ],
        },
        {
          id: 'main_area',
          type: 'Card',
          props: { title: 'Recent Activity' },
          children: [
            {
              id: 't2',
              type: 'TraceRibbon',
              props: {
                events: [{ id: '5', kind: 'policy_eval', payload: { decision: 'allow', rule: 'budget_check' }, ts: new Date().toISOString() }],
              },
            },
          ],
        },
      ],
    };
  }
}
