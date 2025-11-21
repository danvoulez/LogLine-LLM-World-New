import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { ContractsService } from './registry/contracts/contracts.service';
import { IdeasService } from './registry/ideas/ideas.service';
import { PeopleService } from './registry/people/people.service';
import { ObjectsService } from './registry/objects/objects.service';
import { AgentsRegistryService } from './registry/agents/agents-registry.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
    private readonly contractsService: ContractsService,
    private readonly ideasService: IdeasService,
    private readonly peopleService: PeopleService,
    private readonly objectsService: ObjectsService,
    private readonly agentsRegistryService: AgentsRegistryService,
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

    // Check for specific intents
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('contract') || lowerPrompt.includes('contrato')) {
      return { layout: await this.generateRegistryContractsLayout() };
    }
    
    if (lowerPrompt.includes('people') || lowerPrompt.includes('pessoas') || lowerPrompt.includes('person')) {
      return { layout: this.generateRegistryPeopleLayout() };
    }
    
    if (lowerPrompt.includes('object') || lowerPrompt.includes('objeto') || lowerPrompt.includes('item')) {
      return { layout: this.generateRegistryObjectsLayout() };
    }
    
    if (lowerPrompt.includes('idea') || lowerPrompt.includes('ideia') || lowerPrompt.includes('proposal')) {
      return { layout: this.generateRegistryIdeasLayout() };
    }
    
    if (lowerPrompt.includes('agent') || lowerPrompt.includes('agente')) {
      return { layout: this.generateAgentsLayout() };
    }

    // TODO: Use TDLN-T to structure the prompt, then LLM to generate layout
    // For now, return mock layout based on keywords
    const layout = this.generateMockLayout(prompt);

    return { layout };
  }

  private async generateRegistryContractsLayout(): Promise<any> {
    // Try to fetch real data, fallback to mock if empty
    let contractsData: any[] = [];
    let totalValue = 0;
    let activeCount = 0;
    let pendingCount = 0;

    try {
      const contracts = await this.contractsService.findAll({ limit: 20 });
      if (contracts.data && contracts.data.length > 0) {
        contractsData = contracts.data.map((c: any) => ({
          id: c.id.substring(0, 12).toUpperCase(),
          title: c.titulo || 'Untitled Contract',
          parties: `${c.autor_logline_id?.substring(0, 20) || 'Unknown'} <> ${c.contraparte_logline_id?.substring(0, 20) || 'Unknown'}`,
          value: c.valor_total_cents || 0,
          status: c.estado || 'RASCUNHO',
        }));
        totalValue = contracts.data.reduce((sum: number, c: any) => sum + (c.valor_total_cents || 0), 0);
        activeCount = contracts.data.filter((c: any) => c.estado === 'VIGENTE').length;
        pendingCount = contracts.data.filter((c: any) => c.estado === 'RASCUNHO').length;
      }
    } catch (error) {
      console.warn('Failed to fetch contracts, using mock data:', error);
    }

    // Use mock data if no real data
    if (contractsData.length === 0) {
      contractsData = [
        { id: 'CTR-2024-88', title: 'Software Dev Services', parties: 'Acme <> DevBot-Alpha', value: 50000, status: 'VIGENTE' },
        { id: 'CTR-2024-92', title: 'Cloud Infrastructure', parties: 'Acme <> InfraAgent', value: 75000, status: 'RASCUNHO' },
        { id: 'CTR-2024-95', title: 'Data Analysis Pipeline', parties: 'TechCorp <> DataBot', value: 120000, status: 'VIGENTE' },
        { id: 'CTR-2024-97', title: 'Customer Support Automation', parties: 'ServiceCo <> SupportAI', value: 30000, status: 'CONCLUÍDO' },
      ];
      totalValue = 275000;
      activeCount = 2;
      pendingCount = 1;
    }
    return {
      view_id: 'registry_contracts_001',
      title: 'Registry: Active Contracts',
      layout_type: 'dashboard',
      components: [
        {
          id: 'stats_row',
          type: 'Card',
          props: { className: 'grid grid-cols-3 gap-4 bg-transparent border-none shadow-none p-0 mb-6' },
          children: [
            { id: 's1', type: 'Metric', props: { label: 'Total Value', value: `R$ ${(totalValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, trend: 'up', trendValue: '+12%' } },
            { id: 's2', type: 'Metric', props: { label: 'Active Contracts', value: String(activeCount), trend: 'neutral', trendValue: 'Stable' } },
            { id: 's3', type: 'Metric', props: { label: 'Pending Signatures', value: String(pendingCount), trend: 'down', trendValue: '-1' } },
          ],
        },
        {
          id: 'contract_list',
          type: 'Card',
          props: { title: 'Executed Agreements (Ledger)' },
          children: [
            {
              id: 'table_1',
              type: 'Table',
              props: {
                columns: [
                  { key: 'id', header: 'Contract ID', sortable: true },
                  { key: 'title', header: 'Title', width: '40%', sortable: true },
                  { key: 'parties', header: 'Parties', sortable: true },
                  { key: 'value', header: 'Value', sortable: true },
                  { key: 'status', header: 'Status', sortable: true },
                ],
                data: contractsData,
                searchable: true,
                pagination: { pageSize: 10, showPagination: true },
              },
            },
          ],
        },
      ],
    };
  }

  private generateRegistryPeopleLayout(): any {
    return {
      view_id: 'registry_people_001',
      title: 'Registry: People',
      layout_type: 'dashboard',
      components: [
        {
          id: 'stats_row',
          type: 'Card',
          props: { className: 'grid grid-cols-3 gap-4 bg-transparent border-none shadow-none p-0 mb-6' },
          children: [
            { id: 's1', type: 'Metric', props: { label: 'Total People', value: '1,234', trend: 'up', trendValue: '+5%' } },
            { id: 's2', type: 'Metric', props: { label: 'Active Users', value: '892', trend: 'up', trendValue: '+12' } },
            { id: 's3', type: 'Metric', props: { label: 'Verified IDs', value: '1,156', trend: 'up', trendValue: '+8' } },
          ],
        },
        {
          id: 'people_list',
          type: 'Card',
          props: { title: 'People Registry' },
          children: [
            {
              id: 'table_1',
              type: 'Table',
              props: {
                columns: [
                  { key: 'logline_id', header: 'LogLine ID', sortable: true },
                  { key: 'name', header: 'Name', width: '30%', sortable: true },
                  { key: 'email', header: 'Email', sortable: true },
                  { key: 'role', header: 'Role', sortable: true },
                  { key: 'status', header: 'Status', sortable: true },
                ],
                data: [
                  { logline_id: 'LL-BR-2024-12345678-CS', name: 'João Silva', email: 'joao@example.com', role: 'Developer', status: 'ACTIVE' },
                  { logline_id: 'LL-BR-2024-87654321-CS', name: 'Maria Santos', email: 'maria@example.com', role: 'Manager', status: 'ACTIVE' },
                  { logline_id: 'LL-BR-2024-11223344-CS', name: 'Pedro Costa', email: 'pedro@example.com', role: 'Admin', status: 'VERIFIED' },
                ],
                searchable: true,
                pagination: { pageSize: 10, showPagination: true },
              },
            },
          ],
        },
      ],
    };
  }

  private generateRegistryObjectsLayout(): any {
    return {
      view_id: 'registry_objects_001',
      title: 'Registry: Objects',
      layout_type: 'dashboard',
      components: [
        {
          id: 'stats_row',
          type: 'Card',
          props: { className: 'grid grid-cols-4 gap-4 bg-transparent border-none shadow-none p-0 mb-6' },
          children: [
            { id: 's1', type: 'Metric', props: { label: 'Total Objects', value: '456', trend: 'up', trendValue: '+23' } },
            { id: 's2', type: 'Metric', props: { label: 'In Transit', value: '12', trend: 'neutral', trendValue: 'Stable' } },
            { id: 's3', type: 'Metric', props: { label: 'Lost & Found', value: '3', trend: 'down', trendValue: '-1' } },
            { id: 's4', type: 'Metric', props: { label: 'Services', value: '89', trend: 'up', trendValue: '+5' } },
          ],
        },
        {
          id: 'objects_chart',
          type: 'Card',
          props: { title: 'Objects by Type' },
          children: [
            {
              id: 'chart_1',
              type: 'Chart',
              props: {
                type: 'pie',
                data: [
                  { label: 'Documents', value: 120 },
                  { label: 'Files', value: 89 },
                  { label: 'Merchandise', value: 156 },
                  { label: 'Services', value: 89 },
                  { label: 'Inventory', value: 2 },
                ],
              },
            },
          ],
        },
        {
          id: 'objects_list',
          type: 'Card',
          props: { title: 'Recent Objects' },
          children: [
            {
              id: 'table_1',
              type: 'Table',
              props: {
                columns: [
                  { key: 'id', header: 'Object ID', sortable: true },
                  { key: 'name', header: 'Name', width: '30%', sortable: true },
                  { key: 'type', header: 'Type', sortable: true },
                  { key: 'location', header: 'Location', sortable: true },
                  { key: 'custodian', header: 'Custodian', sortable: true },
                ],
                data: [
                  { id: 'OBJ-001', name: 'Server Rack Unit 42', type: 'Merchandise', location: 'Data Center A', custodian: 'LL-BR-2024-12345678-CS' },
                  { id: 'OBJ-002', name: 'API Documentation v2.1', type: 'Document', location: 'Repository', custodian: 'LL-BR-2024-87654321-CS' },
                  { id: 'OBJ-003', name: 'Cloud Migration Service', type: 'Service', location: 'AWS', custodian: 'LL-BR-2024-11223344-CS' },
                ],
                searchable: true,
                pagination: { pageSize: 10, showPagination: true },
              },
            },
          ],
        },
      ],
    };
  }

  private generateRegistryIdeasLayout(): any {
    return {
      view_id: 'registry_ideas_001',
      title: 'Registry: Ideas',
      layout_type: 'dashboard',
      components: [
        {
          id: 'stats_row',
          type: 'Card',
          props: { className: 'grid grid-cols-4 gap-4 bg-transparent border-none shadow-none p-0 mb-6' },
          children: [
            { id: 's1', type: 'Metric', props: { label: 'Total Ideas', value: '67', trend: 'up', trendValue: '+8' } },
            { id: 's2', type: 'Metric', props: { label: 'In Voting', value: '12', trend: 'neutral', trendValue: 'Stable' } },
            { id: 's3', type: 'Metric', props: { label: 'Approved', value: '34', trend: 'up', trendValue: '+5' } },
            { id: 's4', type: 'Metric', props: { label: 'Total Budget', value: 'R$ 2.1M', trend: 'up', trendValue: '+15%' } },
          ],
        },
        {
          id: 'priority_chart',
          type: 'Card',
          props: { title: 'Priority vs Cost Matrix' },
          children: [
            {
              id: 'chart_1',
              type: 'Chart',
              props: {
                type: 'bar',
                data: [
                  { label: 'High Priority', value: 8 },
                  { label: 'Medium Priority', value: 15 },
                  { label: 'Low Priority', value: 12 },
                  { label: 'Pending Review', value: 5 },
                ],
              },
            },
          ],
        },
        {
          id: 'ideas_list',
          type: 'Card',
          props: { title: 'Ideas Queue' },
          children: [
            {
              id: 'table_1',
              type: 'Table',
              props: {
                columns: [
                  { key: 'id', header: 'Idea ID', sortable: true },
                  { key: 'title', header: 'Title', width: '35%', sortable: true },
                  { key: 'priority', header: 'Priority', sortable: true },
                  { key: 'cost', header: 'Est. Cost', sortable: true },
                  { key: 'status', header: 'Status', sortable: true },
                ],
                data: [
                  { id: 'IDEA-001', title: 'Automated Testing Pipeline', priority: 9, cost: 50000, status: 'APROVADA' },
                  { id: 'IDEA-002', title: 'Real-time Analytics Dashboard', priority: 7, cost: 75000, status: 'EM_VOTACAO' },
                  { id: 'IDEA-003', title: 'Mobile App Redesign', priority: 6, cost: 120000, status: 'AGUARDANDO_VOTOS' },
                ],
                searchable: true,
                pagination: { pageSize: 10, showPagination: true },
              },
            },
          ],
        },
      ],
    };
  }

  private generateAgentsLayout(): any {
    return {
      view_id: 'agents_001',
      title: 'Agents Dashboard',
      layout_type: 'dashboard',
      components: [
        {
          id: 'stats_row',
          type: 'Card',
          props: { className: 'grid grid-cols-4 gap-4 bg-transparent border-none shadow-none p-0 mb-6' },
          children: [
            { id: 's1', type: 'Metric', props: { label: 'Total Agents', value: '24', trend: 'up', trendValue: '+3' } },
            { id: 's2', type: 'Metric', props: { label: 'Active Runs', value: '156', trend: 'up', trendValue: '+12' } },
            { id: 's3', type: 'Metric', props: { label: 'Avg Cost/Run', value: 'R$ 0.42', trend: 'down', trendValue: '-8%' } },
            { id: 's4', type: 'Metric', props: { label: 'Success Rate', value: '94.2%', trend: 'up', trendValue: '+2.1%' } },
          ],
        },
        {
          id: 'performance_chart',
          type: 'Card',
          props: { title: 'Agent Performance (Last 7 Days)' },
          children: [
            {
              id: 'chart_1',
              type: 'Chart',
              props: {
                type: 'line',
                data: [
                  { label: 'Mon', value: 45 },
                  { label: 'Tue', value: 52 },
                  { label: 'Wed', value: 48 },
                  { label: 'Thu', value: 61 },
                  { label: 'Fri', value: 55 },
                  { label: 'Sat', value: 38 },
                  { label: 'Sun', value: 42 },
                ],
              },
            },
          ],
        },
        {
          id: 'agents_list',
          type: 'Card',
          props: { title: 'Registered Agents' },
          children: [
            {
              id: 'table_1',
              type: 'Table',
              props: {
                columns: [
                  { key: 'logline_id', header: 'Agent ID', sortable: true },
                  { key: 'name', header: 'Name', width: '25%', sortable: true },
                  { key: 'model', header: 'Model', sortable: true },
                  { key: 'runs', header: 'Total Runs', sortable: true },
                  { key: 'status', header: 'Status', sortable: true },
                ],
                data: [
                  { logline_id: 'LL-AGENT-2024-001-CS', name: 'DevBot-Alpha', model: 'gpt-4o', runs: 1245, status: 'ACTIVE' },
                  { logline_id: 'LL-AGENT-2024-002-CS', name: 'SupportAI', model: 'gpt-4o-mini', runs: 892, status: 'ACTIVE' },
                  { logline_id: 'LL-AGENT-2024-003-CS', name: 'DataBot', model: 'claude-3-5-sonnet', runs: 567, status: 'TRAINING' },
                ],
                searchable: true,
                pagination: { pageSize: 10, showPagination: true },
              },
            },
          ],
        },
      ],
    };
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
