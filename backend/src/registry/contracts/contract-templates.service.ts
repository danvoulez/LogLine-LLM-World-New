import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractTemplate } from './entities/contract-template.entity';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { CreateFromTemplateDto } from './dto/create-from-template.dto';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';

/**
 * Contract Templates Service
 * 
 * Handles:
 * - Template creation and management
 * - Variable interpolation
 * - Contract creation from templates
 */
@Injectable()
export class ContractTemplatesService {
  constructor(
    @InjectRepository(ContractTemplate)
    private templateRepository: Repository<ContractTemplate>,
    private contractsService: ContractsService,
  ) {}

  /**
   * Create a new contract template
   */
  async create(dto: CreateContractTemplateDto): Promise<ContractTemplate> {
    const template = this.templateRepository.create({
      ...dto,
      versao: dto.versao || 1,
      ativo: true,
    });

    return this.templateRepository.save(template);
  }

  /**
   * Find template by ID
   */
  async findOne(id: string): Promise<ContractTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Contract template with ID ${id} not found`);
    }

    if (!template.ativo) {
      throw new BadRequestException(`Contract template ${id} is not active`);
    }

    return template;
  }

  /**
   * Find templates by criteria
   */
  async findAll(filters: {
    tenant_id?: string;
    categoria?: string;
    ativo?: boolean;
  }): Promise<ContractTemplate[]> {
    const query = this.templateRepository.createQueryBuilder('template');

    if (filters.tenant_id) {
      query.andWhere('template.tenant_id = :tenantId', {
        tenantId: filters.tenant_id,
      });
    }

    if (filters.categoria) {
      query.andWhere('template.categoria = :categoria', {
        categoria: filters.categoria,
      });
    }

    if (filters.ativo !== undefined) {
      query.andWhere('template.ativo = :ativo', { ativo: filters.ativo });
    }

    return query.orderBy('template.titulo', 'ASC').getMany();
  }

  /**
   * Validate that all required variables are provided
   */
  private validateVariables(
    required: string[],
    provided: Record<string, any>,
  ): void {
    const missing = required.filter((varName) => !(varName in provided));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required variables: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Interpolate variables in template data
   */
  private interpolateTemplate(
    templateData: Record<string, any>,
    variables: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(templateData)) {
      if (typeof value === 'string') {
        // Check for {{variable}} pattern
        if (value.match(/\{\{([^}]+)\}\}/)) {
          // If string is EXACTLY "{{var}}", replace with value (preserve type)
          if (value.startsWith('{{') && value.endsWith('}}') && value.split('{{').length === 2) {
            const varName = value.slice(2, -2).trim();
            if (varName in variables) {
              result[key] = variables[varName];
            } else {
              throw new BadRequestException(
                `Variable ${varName} not provided in variables`,
              );
            }
          } else {
            // Partial replacement (string interpolation)
            result[key] = value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, varName) => {
              const cleanVarName = varName.trim();
              if (cleanVarName in variables) {
                return String(variables[cleanVarName]);
              }
              throw new BadRequestException(
                `Variable ${cleanVarName} not provided in variables`,
              );
            });
          }
        } else {
          result[key] = value;
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively interpolate nested objects
        result[key] = this.interpolateTemplate(value, variables);
      } else if (Array.isArray(value)) {
        // Interpolate array elements
        result[key] = value.map((item) => {
          if (typeof item === 'string') {
             if (item.startsWith('{{') && item.endsWith('}}') && item.split('{{').length === 2) {
                const varName = item.slice(2, -2).trim();
                return variables[varName] ?? item;
             }
             // Partial replacement in array strings
             return item.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, varName) => {
                const cleanVarName = varName.trim();
                return variables[cleanVarName] !== undefined ? String(variables[cleanVarName]) : match;
             });
          }
          return item;
        });
      } else {
        // Use value as-is
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Create contract from template
   */
  async createFromTemplate(
    dto: CreateFromTemplateDto,
  ): Promise<any> {
    const template = await this.findOne(dto.template_id);

    // Validate required variables
    this.validateVariables(template.required_variables, dto.variables);

    // Interpolate template with variables
    const interpolatedData = this.interpolateTemplate(
      template.template_data,
      dto.variables,
    );

    // Build CreateContractDto
    const contractDto: CreateContractDto = {
      tenant_id: dto.tenant_id,
      tipo: interpolatedData.tipo || 'prestacao_servico',
      titulo: dto.titulo,
      descricao: template.descricao,
      autor_logline_id: dto.autor_logline_id,
      contraparte_logline_id: dto.contraparte_logline_id,
      escopo: interpolatedData.escopo,
      prazo_dias: interpolatedData.prazo_dias,
      valor_total_cents: dto.variables.valor_total_cents,
      forma_pagamento: dto.variables.forma_pagamento,
      multa_atraso: interpolatedData.multa_atraso,
      clausulas: interpolatedData.clausulas,
      data_inicio: dto.variables.data_inicio,
    };

    // Create contract using ContractsService
    return this.contractsService.create(contractDto);
  }

  /**
   * Update template
   */
  async update(
    id: string,
    updates: Partial<CreateContractTemplateDto>,
  ): Promise<ContractTemplate> {
    const template = await this.findOne(id);

    Object.assign(template, updates);
    return this.templateRepository.save(template);
  }

  /**
   * Deactivate template
   */
  async deactivate(id: string): Promise<ContractTemplate> {
    const template = await this.findOne(id);
    template.ativo = false;
    return this.templateRepository.save(template);
  }
}

