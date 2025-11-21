import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { ContractsService } from './registry/contracts/contracts.service';
import { IdeasService } from './registry/ideas/ideas.service';
import { PeopleService } from './registry/people/people.service';
import { ObjectsService } from './registry/objects/objects.service';
import { AgentsRegistryService } from './registry/agents/agents-registry.service';
import { LlmRouterService } from './llm/llm-router.service';

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
    private readonly llmRouter: LlmRouterService,
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
  @Post('render')
  async renderLayout(@Body() body: { prompt: string; context?: any }): Promise<{ layout: any }> {
    const { prompt, context } = body;

    // First, try keyword-based routing for known Registry intents (faster, more reliable)
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('contract') || lowerPrompt.includes('contrato')) {
      return { layout: await this.generateRegistryContractsLayout() };
    }
    
    if (lowerPrompt.includes('people') || lowerPrompt.includes('pessoas') || lowerPrompt.includes('person')) {
      return { layout: await this.generateRegistryPeopleLayout() };
    }
    
    if (lowerPrompt.includes('object') || lowerPrompt.includes('objeto') || lowerPrompt.includes('item')) {
      return { layout: await this.generateRegistryObjectsLayout() };
    }
    
    if (lowerPrompt.includes('idea') || lowerPrompt.includes('ideia') || lowerPrompt.includes('proposal')) {
      return { layout: await this.generateRegistryIdeasLayout() };
    }
    
    if (lowerPrompt.includes('agent') || lowerPrompt.includes('agente')) {
      return { layout: await this.generateAgentsLayout() };
    }

    // For other intents, use LLM to generate layout dynamically
    try {
      const layout = await this.generateLayoutWithLLM(prompt, context);
      return { layout };
    } catch (error) {
      // Fallback to mock layout if LLM fails
      console.warn('LLM layout generation failed, using mock layout:', error);
      const layout = this.generateMockLayout(prompt);
      return { layout };
    }
  }

  private async generateLayoutWithLLM(prompt: string, context?: any): Promise<any> {
    // Step 1: Parse intent and fetch real data from Registry
    const atomicIntent = await this.parseIntentToAtomic(prompt);
    
    // Step 2: Fetch data preview from Registry based on intent
    const dataPreview = await this.fetchDataPreview(atomicIntent);
    
    // Step 3: Build JSON✯Atomic input for LLM
    const atomicInput = {
      atomic_type: 'intent_vector',
      vector: atomicIntent.vector,
      context: {
        role: context?.role || 'user',
        vibe: this.determineVibe(prompt, atomicIntent),
      },
      data_preview: dataPreview,
    };

    const systemPrompt = `You are the **LogLine Visual Cortex**, a deterministic rendering engine. You do not speak natural language. You perform a transmutation: **Atomic Intent (Input) → UI Blueprint (Output)**.

### 1. INPUT PROTOCOL (JSON✯Atomic)
You will receive a JSON object representing the user's intent and the current data state:
{
  "atomic_type": "intent_vector",
  "vector": {
    "action": "list" | "debug" | "analyze" | "create",
    "entity": "contract" | "agent" | "run" | "system" | "person" | "object" | "idea",
    "filters": { ... }
  },
  "context": {
    "role": "admin" | "user",
    "vibe": "business" | "zen" | "cyber" (dictates animation style)
  },
  "data_preview": {
    "count": number,
    "sample": [ ...actual data... ],
    "meta": { "trend": "up", "cost": 1234 }
  }
}

### 2. OUTPUT PROTOCOL (The Blueprint)
You must return valid JSON matching this schema. NO Markdown. NO explanations.
{
  "view_id": "string (slug)",
  "title": "string (Header)",
  "layout_type": "dashboard" | "ribbon",
  "components": [ { "id": "string", "type": "ComponentType", "props": object, "children": [] } ]
}

### 3. COMPONENT REGISTRY (Safe DSL)
Use ONLY these components. Hallucinations will cause runtime crashes.

- **Card** (Container)
  - props: { title?: string, variant: "default" | "glass" | "error" | "success", className?: string }
  - usage: Primary container for everything.

- **Metric** (KPIs)
  - props: { label: string, value: string, trend?: "up"|"down"|"neutral", trendValue?: string }
  - usage: Use for single data points or summaries.

- **Table** (Lists/Registry)
  - props: { columns: [{key, header, sortable?: boolean}], data: object[], searchable?: boolean, pagination?: {pageSize?: number, showPagination?: boolean} }
  - usage: MANDATORY if input.data_preview.count > 1.

- **TraceRibbon** (Debug/Flow)
  - props: { events: object[] }
  - usage: MANDATORY if vector.action == "debug" or "trace".

- **Chart** (Data Visualization)
  - props: { type: "bar" | "line" | "pie" | "area", data: [{label, value, color?}], title?: string }

- **Badge** (Status Indicators)
  - props: { variant: "default" | "success" | "warning" | "error" | "info" | "neutral", size?: "sm" | "md" | "lg" }

### 4. RENDERING HEURISTICS (The Brain)
1. **The Volume Rule:** If \`data_preview.count\` is 0, render a "Zen Mode" empty state. If > 1, render a \`Table\`. If huge, render high-level \`Metric\` summaries first.
2. **The Vibe Rule:** If \`context.vibe\` is "cyber", use \`variant: "glass"\` on cards. If "business", use \`variant: "default"\`.
3. **The Data Integrity Rule:** Do not invent data. Map fields from \`data_preview.sample\` directly to \`Table\` columns.

### 5. START TRANSMUTATION`;

    try {
      const result = await this.llmRouter.generateText(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(atomicInput, null, 2) },
        ],
        {
          provider: process.env.LLM_PROVIDER || 'openai',
          model: process.env.LLM_MODEL || 'gpt-4o-mini',
          temperature: 0.2, // Very low for deterministic JSON
          maxTokens: 2500,
        },
        undefined, // No tools
        { agentId: 'visual-cortex', runId: 'render-layout' },
      );

      // Parse JSON from response
      const jsonText = result.text.trim();
      // Remove markdown code blocks if present
      const cleanJson = jsonText.replace(/^```json\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '');
      
      const layout = JSON.parse(cleanJson);
      
      // Validate basic structure
      if (!layout.view_id || !layout.title || !layout.components) {
        throw new Error('Invalid layout structure from LLM');
      }

      return layout;
    } catch (error) {
      console.error('LLM layout generation error:', error);
      throw error; // Will be caught by caller and fallback to mock
    }
  }

  /**
   * Parse natural language prompt into JSON✯Atomic intent vector
   */
  private async parseIntentToAtomic(prompt: string): Promise<{
    vector: {
      action: 'list' | 'debug' | 'analyze' | 'create' | 'show' | 'view';
      entity: 'contract' | 'agent' | 'run' | 'system' | 'person' | 'object' | 'idea' | 'general';
      filters: Record<string, any>;
    };
  }> {
    const lower = prompt.toLowerCase();
    
    // Determine action
    let action: 'list' | 'debug' | 'analyze' | 'create' | 'show' | 'view' = 'show';
    if (lower.includes('debug') || lower.includes('trace') || lower.includes('error')) {
      action = 'debug';
    } else if (lower.includes('analyze') || lower.includes('analysis') || lower.includes('cost')) {
      action = 'analyze';
    } else if (lower.includes('list') || lower.includes('show all') || lower.includes('all')) {
      action = 'list';
    } else if (lower.includes('create') || lower.includes('new')) {
      action = 'create';
    } else if (lower.includes('show') || lower.includes('view') || lower.includes('display')) {
      action = 'show';
    }

    // Determine entity
    let entity: 'contract' | 'agent' | 'run' | 'system' | 'person' | 'object' | 'idea' | 'general' = 'general';
    if (lower.includes('contract') || lower.includes('contrato')) {
      entity = 'contract';
    } else if (lower.includes('agent') || lower.includes('agente')) {
      entity = 'agent';
    } else if (lower.includes('run') || lower.includes('execution')) {
      entity = 'run';
    } else if (lower.includes('person') || lower.includes('people') || lower.includes('pessoa')) {
      entity = 'person';
    } else if (lower.includes('object') || lower.includes('objeto') || lower.includes('item')) {
      entity = 'object';
    } else if (lower.includes('idea') || lower.includes('ideia') || lower.includes('proposal')) {
      entity = 'idea';
    } else if (lower.includes('system') || lower.includes('status') || lower.includes('overview')) {
      entity = 'system';
    }

    // Extract filters (simple keyword extraction for now)
    const filters: Record<string, any> = {};
    // Could be enhanced with NER or more sophisticated parsing

    return {
      vector: {
        action,
        entity,
        filters,
      },
    };
  }

  /**
   * Fetch data preview from Registry based on atomic intent
   */
  private async fetchDataPreview(atomicIntent: {
    vector: {
      action: string;
      entity: string;
      filters: Record<string, any>;
    };
  }): Promise<{
    count: number;
    sample: any[];
    meta?: Record<string, any>;
  }> {
    const { action, entity, filters } = atomicIntent.vector;

    try {
      if (entity === 'contract') {
        const contracts = await this.contractsService.findAll({ limit: 10 });
        return {
          count: contracts.total || contracts.data?.length || 0,
          sample: (contracts.data || []).slice(0, 5).map((c: any) => ({
            id: c.id?.substring(0, 12).toUpperCase() || 'N/A',
            title: c.titulo || 'Untitled',
            status: c.estado || 'RASCUNHO',
            value: c.valor_total_cents ? `R$ ${(c.valor_total_cents / 100).toFixed(2)}` : 'N/A',
            parties: `${c.autor_logline_id?.substring(0, 15) || 'Unknown'} <> ${c.contraparte_logline_id?.substring(0, 15) || 'Unknown'}`,
          })),
          meta: {
            total_value_cents: contracts.data?.reduce((sum: number, c: any) => sum + (c.valor_total_cents || 0), 0) || 0,
            active_count: contracts.data?.filter((c: any) => c.estado === 'VIGENTE').length || 0,
          },
        };
      }

      if (entity === 'person') {
        const people = await this.peopleService.search({});
        return {
          count: Array.isArray(people) ? people.length : 0,
          sample: (Array.isArray(people) ? people : []).slice(0, 5).map((p: any) => ({
            logline_id: p.logline_id || 'N/A',
            name: p.name || 'Unknown',
            email: p.email_primary || 'N/A',
            role: p.tenant_relationships?.[0]?.role || 'N/A',
          })),
        };
      }

      if (entity === 'object') {
        const objects = await this.objectsService.findAll({ limit: 10 });
        const objectsData = objects.data || [];
        return {
          count: objects.total || objectsData.length,
          sample: objectsData.slice(0, 5).map((o: any) => ({
            id: o.id?.substring(0, 12).toUpperCase() || 'N/A',
            name: o.name || 'Untitled',
            type: o.object_type || 'N/A',
            location: o.location || 'N/A',
            custodian: o.current_custodian_logline_id?.substring(0, 15) || 'N/A',
          })),
        };
      }

      if (entity === 'idea') {
        const ideas = await this.ideasService.findAll({ tenant_id: filters.tenant_id, limit: 10 });
        return {
          count: ideas.total || ideas.data?.length || 0,
          sample: (ideas.data || []).slice(0, 5).map((i: any) => ({
            id: i.id?.substring(0, 12).toUpperCase() || 'N/A',
            title: i.titulo || 'Untitled',
            priority: i.prioridade_consensual || 0,
            cost: i.custo_estimado_cents ? `R$ ${(i.custo_estimado_cents / 100).toFixed(2)}` : 'N/A',
            status: i.status || 'AGUARDANDO_VOTOS',
          })),
          meta: {
            total_budget_cents: ideas.data?.reduce((sum: number, i: any) => sum + (i.custo_estimado_cents || 0), 0) || 0,
          },
        };
      }

      if (entity === 'agent') {
        const agents = await this.agentsRegistryService.findAll({ limit: 10 });
        const agentsData = agents.data || [];
        return {
          count: agents.total || agentsData.length,
          sample: agentsData.slice(0, 5).map((a: any) => ({
            logline_id: a.logline_agent_id || 'N/A',
            name: a.name || 'Unknown',
            model: a.model_profile?.model || 'N/A',
            status: a.onboarding_status || 'INACTIVE',
            runs: a.total_runs || 0,
          })),
        };
      }

      // Default: empty preview
      return {
        count: 0,
        sample: [],
        meta: {},
      };
    } catch (error) {
      console.warn('Failed to fetch data preview, using empty:', error);
      return {
        count: 0,
        sample: [],
        meta: {},
      };
    }
  }

  /**
   * Determine vibe based on prompt and intent
   */
  private determineVibe(prompt: string, atomicIntent: any): 'business' | 'zen' | 'cyber' {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('debug') || lower.includes('error') || lower.includes('trace')) {
      return 'cyber';
    }
    if (lower.includes('cost') || lower.includes('budget') || lower.includes('financial')) {
      return 'business';
    }
    if (atomicIntent.vector.action === 'debug') {
      return 'cyber';
    }
    
    return 'business'; // Default
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

  private async generateRegistryPeopleLayout(): Promise<any> {
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

  private async generateRegistryObjectsLayout(): Promise<any> {
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

  private async generateRegistryIdeasLayout(): Promise<any> {
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

  private async generateAgentsLayout(): Promise<any> {
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
