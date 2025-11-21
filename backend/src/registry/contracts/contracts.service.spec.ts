import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ContractsService } from './contracts.service';
import { RegistryContract } from './entities/registry-contract.entity';
import { RegistryContractStateHistory } from './entities/registry-contract-state-history.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LogLineIdService } from '../common/logline-id.service';

import { RegistryEventsService } from '../registry-events.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let contractRepository: Repository<RegistryContract>;
  let stateHistoryRepository: Repository<RegistryContractStateHistory>;
  let dataSource: DataSource;

  const mockContractRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockStateHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback({
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    })),
  };

  const mockLoglineIdService = {
    generatePersonId: jest.fn(),
    generateAgentId: jest.fn(),
    extractBaseId: jest.fn((id) => id.split('-').slice(0, 4).join('-')),
    validateLogLineId: jest.fn().mockReturnValue(true),
  };

  const mockRegistryEventsService = {
    emitContractCreated: jest.fn(),
    emitContractStateChanged: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: getRepositoryToken(RegistryContract),
          useValue: mockContractRepository,
        },
        {
          provide: getRepositoryToken(RegistryContractStateHistory),
          useValue: mockStateHistoryRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: LogLineIdService,
          useValue: mockLoglineIdService,
        },
        {
          provide: RegistryEventsService,
          useValue: mockRegistryEventsService,
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    contractRepository = module.get<Repository<RegistryContract>>(
      getRepositoryToken(RegistryContract),
    );
    stateHistoryRepository = module.get<Repository<RegistryContractStateHistory>>(
      getRepositoryToken(RegistryContractStateHistory),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new contract in RASCUNHO state', async () => {
      const dto: CreateContractDto = {
        tenant_id: 'tenant-123',
        tipo: 'prestacao_servico',
        titulo: 'Development Contract',
        autor_logline_id: 'LL-BR-2024-000000001',
        contraparte_logline_id: 'LL-BR-2024-000000002',
        valor_total: 10000,
      };

      const contract = {
        id: 'contract-123',
        ...dto,
        estado_atual: 'RASCUNHO',
        moeda: 'BRL',
        periodo_defesa_dias: 3,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockContractRepository.create.mockReturnValue(contract);
      mockContractRepository.save.mockResolvedValue(contract);
      
      // Mock transitionState - it calls findOne first, then uses transaction
      const contractForTransition = { ...contract, estado_atual: 'RASCUNHO' };
      mockContractRepository.findOne.mockResolvedValue(contractForTransition);
      
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: null,
        estado_novo: 'RASCUNHO',
      });
      
      // Mock transaction for transitionState
      const manager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(manager);
      });

      const result = await service.create(dto);

      expect(result.estado_atual).toBe('RASCUNHO');
      expect(manager.save).toHaveBeenCalledTimes(2); // Contract and history
    });
  });

  describe('sign', () => {
    it('should sign contract (RASCUNHO → VIGENTE)', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'RASCUNHO',
        autor_logline_id: 'LL-BR-2024-000000001',
        contraparte_logline_id: 'LL-BR-2024-000000002',
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        estado_atual: 'VIGENTE',
      });
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: 'RASCUNHO',
        estado_novo: 'VIGENTE',
      });

      const result = await service.sign('contract-123', 'LL-BR-2024-000000001');

      expect(result.estado_atual).toBe('VIGENTE');
    });

    it('should throw BadRequestException if contract cannot be signed', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'VIGENTE',
      };

      mockContractRepository.findOne.mockResolvedValue(contract);

      await expect(
        service.sign('contract-123', 'LL-BR-2024-000000001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('question', () => {
    it('should question contract (VIGENTE → QUESTIONADO)', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'VIGENTE',
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        questionamento_razao: 'Late delivery',
        questionamento_data: expect.any(Date),
      });
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: 'VIGENTE',
        estado_novo: 'QUESTIONADO',
      });

      const result = await service.question(
        'contract-123',
        'Late delivery',
        'LL-BR-2024-000000001',
      );

      expect(result.estado_atual).toBe('QUESTIONADO');
      expect(result.questionamento_razao).toBe('Late delivery');
    });
  });

  describe('defend', () => {
    it('should add justification to questioned contract', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'QUESTIONADO',
        justificativa: null,
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        justificativa: 'Health issue with medical certificate',
      });

      const result = await service.defend(
        'contract-123',
        'Health issue with medical certificate',
        'LL-BR-2024-000000002',
      );

      expect(result.justificativa).toBe('Health issue with medical certificate');
    });
  });

  describe('resolve', () => {
    it('should accept justification and return to VIGENTE', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'QUESTIONADO',
        justificativa: 'Health issue',
        justificativa_aceita: null,
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        justificativa_aceita: true,
      });
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: 'QUESTIONADO',
        estado_novo: 'VIGENTE',
      });

      const result = await service.resolve('contract-123', true, 'LL-BR-2024-000000001');

      expect(result.estado_atual).toBe('VIGENTE');
    });

    it('should reject justification and apply penalty', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'QUESTIONADO',
        justificativa: 'Excuse',
        valor_total_cents: 1000000, // 10000.00
        multa_atraso: { tipo: 'percentual_dia', valor: 2 },
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        justificativa_aceita: false,
        penalidade_aplicada_cents: 20000,
        penalidade_data: expect.any(Date),
      });
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: 'QUESTIONADO',
        estado_novo: 'PENALIZADO',
      });

      const result = await service.resolve('contract-123', false, 'LL-BR-2024-000000001');

      expect(result.estado_atual).toBe('PENALIZADO');
      expect(result.penalidade_aplicada_cents).toBe(20000);
    });
  });

  describe('complete', () => {
    it('should complete contract (VIGENTE → CONCLUÍDO)', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'VIGENTE',
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        estado_atual: 'CONCLUÍDO',
      });
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: 'VIGENTE',
        estado_novo: 'CONCLUÍDO',
      });

      const result = await service.complete('contract-123', 'LL-BR-2024-000000001');

      expect(result.estado_atual).toBe('CONCLUÍDO');
    });
  });

  describe('cancel', () => {
    it('should cancel contract', async () => {
      const contract = {
        id: 'contract-123',
        estado_atual: 'VIGENTE',
      };

      mockContractRepository.findOne.mockResolvedValue(contract);
      mockContractRepository.save.mockResolvedValue({
        ...contract,
        estado_atual: 'CANCELADO',
      });
      mockStateHistoryRepository.create.mockReturnValue({
        id: 'history-123',
        contract_id: 'contract-123',
        estado_anterior: 'VIGENTE',
        estado_novo: 'CANCELADO',
      });

      const result = await service.cancel(
        'contract-123',
        'Mutual agreement',
        'LL-BR-2024-000000001',
      );

      expect(result.estado_atual).toBe('CANCELADO');
    });
  });
});

