import { Injectable, Logger } from '@nestjs/common';
import { PeopleService } from './people/people.service';
import { ContractsService } from './contracts/contracts.service';
import { ObjectsService } from './objects/objects.service';
import { IdeasService } from './ideas/ideas.service';
import { ToolDefinition, ToolHandler, ToolContext } from '../tools/tool-runtime.service';

@Injectable()
export class RegistryTool {
  private readonly logger = new Logger(RegistryTool.name);

  constructor(
    private peopleService: PeopleService,
    private contractsService: ContractsService,
    private objectsService: ObjectsService,
    private ideasService: IdeasService,
  ) {}

  getAllTools(): ToolDefinition[] {
    return [
      this.createLookupPersonTool(),
      this.createGetContractTool(),
      this.createCheckObjectTool(),
      this.createSearchIdeasTool(),
    ];
  }

  private createLookupPersonTool(): ToolDefinition {
    return {
      id: 'registry_lookup_person',
      name: 'Registry: Lookup Person',
      description: 'Resolve a person identity by LogLine ID, CPF, or Email.',
      risk_level: 'low',
      side_effects: ['database_read'],
      input_schema: {
        type: 'object',
        properties: {
          logline_id: { type: 'string', description: 'The unique LogLine ID' },
          cpf: { type: 'string', description: 'CPF number (will be hashed)' },
          email: { type: 'string', description: 'Email address' },
        },
        anyOf: [
            { required: ['logline_id'] },
            { required: ['cpf'] },
            { required: ['email'] }
        ]
      },
      handler: async (input: any, ctx: ToolContext) => {
        if (input.logline_id) {
          const person = await this.peopleService.findByLogLineId(input.logline_id, input.cpf);
          if (!person) return { found: false, message: 'Person not found by LogLine ID' };
          return { found: true, person: this.sanitizePerson(person) };
        }
        
        const results = await this.peopleService.search({
            email: input.email,
            cpf: input.cpf,
            limit: 1
        });
        
        if (results.length > 0) {
            return { found: true, person: this.sanitizePerson(results[0]) };
        }

        return { found: false, message: 'Person not found' };
      },
    };
  }

  private createGetContractTool(): ToolDefinition {
    return {
      id: 'registry_get_contract',
      name: 'Registry: Get Contract',
      description: 'Get details and status of a contract.',
      risk_level: 'low',
      side_effects: ['database_read'],
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Contract UUID' },
        },
        required: ['id'],
      },
      handler: async (input: any, ctx: ToolContext) => {
        try {
          const contract = await this.contractsService.findOne(input.id);
          return {
            found: true,
            contract: {
              id: contract.id,
              titulo: contract.titulo,
              estado_atual: contract.estado_atual,
              escopo: contract.escopo,
              valor_total_cents: contract.valor_total_cents,
              data_inicio: contract.data_inicio,
              data_limite: contract.data_limite,
              autor_logline_id: contract.autor_logline_id,
              contraparte_logline_id: contract.contraparte_logline_id,
            },
          };
        } catch (error) {
          return { found: false, message: 'Contract not found' };
        }
      },
    };
  }

  private createCheckObjectTool(): ToolDefinition {
    return {
      id: 'registry_check_object',
      name: 'Registry: Check Object',
      description: 'Check status, location and custody of a registry object.',
      risk_level: 'low',
      side_effects: ['database_read'],
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Object UUID' },
        },
        required: ['id'],
      },
      handler: async (input: any, ctx: ToolContext) => {
        try {
          const object = await this.objectsService.findOne(input.id);
          return {
            found: true,
            object: {
              id: object.id,
              name: object.name,
              object_type: object.object_type,
              current_location: object.location, // Corrected
              current_custodian_logline_id: object.current_custodian_logline_id,
              status: object.lost_found_status || 'ok', // Corrected
              metadata: object.metadata,
            },
          };
        } catch (error) {
          return { found: false, message: 'Object not found' };
        }
      },
    };
  }

  private createSearchIdeasTool(): ToolDefinition {
    return {
      id: 'registry_search_ideas',
      name: 'Registry: Search Ideas',
      description: 'Search for ideas based on status or tenant.',
      risk_level: 'low',
      side_effects: ['database_read'],
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['rascunho', 'aguardando_votos', 'em_votacao', 'aprovada', 'rejeitada', 'arquivada'] },
          limit: { type: 'number', default: 5 },
        },
      },
      handler: async (input: any, ctx: ToolContext) => {
        const result = await this.ideasService.findAll({
          tenant_id: ctx.tenantId,
          status: input.status as any,
          limit: input.limit || 5,
        });
        
        return {
          count: result.total,
          ideas: result.data.map(idea => ({
            id: idea.id,
            titulo: idea.titulo,
            prioridade: idea.prioridade_consensual,
            custo_estimado_cents: idea.custo_estimado_cents,
            status: idea.status
          })),
        };
      },
    };
  }

  private sanitizePerson(person: any) {
    return {
      logline_id: person.logline_id,
      name: person.name,
      email: person.email_primary, 
      created_at: person.created_at,
    };
  }
}
