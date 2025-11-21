import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractTemplatesService } from './contract-templates.service';
import { ContractsService } from './contracts.service';
import { ContractTemplate } from './entities/contract-template.entity';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { CreateFromTemplateDto } from './dto/create-from-template.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ContractTemplatesService', () => {
  let service: ContractTemplatesService;
  let templateRepository: Repository<ContractTemplate>;
  let contractsService: ContractsService;

  const mockTemplateRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockContractsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractTemplatesService,
        {
          provide: getRepositoryToken(ContractTemplate),
          useValue: mockTemplateRepository,
        },
        {
          provide: ContractsService,
          useValue: mockContractsService,
        },
      ],
    }).compile();

    service = module.get<ContractTemplatesService>(ContractTemplatesService);
    templateRepository = module.get<Repository<ContractTemplate>>(
      getRepositoryToken(ContractTemplate),
    );
    contractsService = module.get<ContractsService>(ContractsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new contract template', async () => {
      const dto: CreateContractTemplateDto = {
        tenant_id: 'tenant-123',
        titulo: 'Standard Service Agreement',
        template_data: {
          tipo: 'prestacao_servico',
          prazo_dias: 30,
        },
        required_variables: ['valor_total_cents', 'data_inicio'],
      };

      const template = {
        id: 'template-123',
        ...dto,
        versao: 1,
        ativo: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTemplateRepository.create.mockReturnValue(template);
      mockTemplateRepository.save.mockResolvedValue(template);

      const result = await service.create(dto);

      expect(result).toEqual(template);
      expect(mockTemplateRepository.create).toHaveBeenCalledWith({
        ...dto,
        versao: 1,
        ativo: true,
      });
    });
  });

  describe('createFromTemplate', () => {
    it('should create a contract from template with variable interpolation', async () => {
      const template = {
        id: 'template-123',
        tenant_id: 'tenant-123',
        titulo: 'Standard Service Agreement',
        descricao: 'Standard contract',
        template_data: {
          tipo: 'prestacao_servico',
          escopo: ['Development of {{project_name}}'],
          prazo_dias: 30,
          multa_atraso: { tipo: 'percentual_dia', valor: 2 },
          clausulas: {
            consequencia_normal: 'Payment of {{valor_total_cents}} cents upon completion',
          },
        },
        required_variables: ['project_name', 'valor_total_cents', 'data_inicio'],
        ativo: true,
      };

      const dto: CreateFromTemplateDto = {
        template_id: 'template-123',
        autor_logline_id: 'LL-BR-2024-000000001',
        contraparte_logline_id: 'LL-BR-2024-000000002',
        titulo: 'My Project Contract',
        tenant_id: 'tenant-123',
        variables: {
          project_name: 'Super App',
          valor_total_cents: 1000000, // 10,000.00
          data_inicio: '2024-01-01',
          forma_pagamento: 'pix',
        },
      };

      mockTemplateRepository.findOne.mockResolvedValue(template);
      mockContractsService.create.mockResolvedValue({ id: 'contract-123' });

      await service.createFromTemplate(dto);

      expect(mockContractsService.create).toHaveBeenCalledWith({
        tenant_id: dto.tenant_id,
        tipo: 'prestacao_servico',
        titulo: dto.titulo,
        descricao: template.descricao,
        autor_logline_id: dto.autor_logline_id,
        contraparte_logline_id: dto.contraparte_logline_id,
        escopo: ['Development of Super App'], // Interpolated
        prazo_dias: 30,
        valor_total_cents: 1000000,
        forma_pagamento: 'pix',
        multa_atraso: { tipo: 'percentual_dia', valor: 2 },
        clausulas: {
          consequencia_normal: 'Payment of 1000000 cents upon completion', // Interpolated
        },
        data_inicio: '2024-01-01',
      });
    });

    it('should throw BadRequestException if required variable is missing', async () => {
      const template = {
        id: 'template-123',
        required_variables: ['required_var'],
        template_data: {},
        ativo: true,
      };

      mockTemplateRepository.findOne.mockResolvedValue(template);

      const dto: CreateFromTemplateDto = {
        template_id: 'template-123',
        autor_logline_id: '1',
        contraparte_logline_id: '2',
        titulo: 'Test',
        tenant_id: '1',
        variables: {}, // Missing 'required_var'
      };

      await expect(service.createFromTemplate(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if template variable is not provided in variables', async () => {
      const template = {
        id: 'template-123',
        required_variables: [],
        template_data: {
          some_field: '{{missing_var}}',
        },
        ativo: true,
      };

      mockTemplateRepository.findOne.mockResolvedValue(template);

      const dto: CreateFromTemplateDto = {
        template_id: 'template-123',
        autor_logline_id: '1',
        contraparte_logline_id: '2',
        titulo: 'Test',
        tenant_id: '1',
        variables: {}, 
      };

      await expect(service.createFromTemplate(dto)).rejects.toThrow(BadRequestException);
    });
  });
});

