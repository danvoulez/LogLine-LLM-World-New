import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PeopleService } from './people.service';
import { CorePerson } from './entities/core-person.entity';
import { TenantPeopleRelationship } from './entities/tenant-people-relationship.entity';
import { RegisterPersonDto } from './dto/register-person.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { LogLineIdService } from '../common/logline-id.service';

describe('PeopleService', () => {
  let service: PeopleService;
  let corePersonRepository: Repository<CorePerson>;
  let tenantRelationshipRepository: Repository<TenantPeopleRelationship>;
  let dataSource: DataSource;

  const mockCorePersonRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTenantRelationshipRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockLoglineIdService = {
    generatePersonId: jest.fn().mockResolvedValue('LL-BR-2024-000000001-A3'),
    extractBaseId: jest.fn((id) => id.split('-').slice(0, 4).join('-')),
    validateLogLineId: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeopleService,
        {
          provide: getRepositoryToken(CorePerson),
          useValue: mockCorePersonRepository,
        },
        {
          provide: getRepositoryToken(TenantPeopleRelationship),
          useValue: mockTenantRelationshipRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: LogLineIdService,
          useValue: mockLoglineIdService,
        },
      ],
    }).compile();

    service = module.get<PeopleService>(PeopleService);
    corePersonRepository = module.get<Repository<CorePerson>>(
      getRepositoryToken(CorePerson),
    );
    tenantRelationshipRepository = module.get<Repository<TenantPeopleRelationship>>(
      getRepositoryToken(TenantPeopleRelationship),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new person', async () => {
      const dto: RegisterPersonDto = {
        cpf: '123.456.789-00',
        email: 'test@example.com',
        name: 'Test User',
        tenant_id: 'tenant-123',
        role: 'customer',
      };

      const loglineId = 'LL-BR-2024-000000001';
      const person = {
        logline_id: loglineId,
        cpf_hash: expect.any(String),
        email_primary: dto.email,
        name: dto.name,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const relationship = {
        id: 'rel-123',
        logline_id: loglineId,
        tenant_id: dto.tenant_id,
        role: dto.role,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCorePersonRepository.findOne.mockResolvedValue(null);
      mockCorePersonRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockCorePersonRepository.create.mockReturnValue(person);
      mockCorePersonRepository.save.mockResolvedValue(person);
      mockTenantRelationshipRepository.create.mockReturnValue(relationship);
      mockTenantRelationshipRepository.save.mockResolvedValue(relationship);

      const result = await service.register(dto);

      expect(result.created).toBe(true);
      expect(result.logline_id).toMatch(/^LL-BR-\d{4}-\d{9}-[A-F0-9]{2}$/);
      expect(mockCorePersonRepository.save).toHaveBeenCalled();
      expect(mockTenantRelationshipRepository.save).toHaveBeenCalled();
    });

    it('should link existing person to tenant', async () => {
      const dto: RegisterPersonDto = {
        cpf: '123.456.789-00',
        email: 'test@example.com',
        name: 'Test User',
        tenant_id: 'tenant-123',
      };

      const existingPerson = {
        logline_id: 'LL-BR-2024-000000001',
        cpf_hash: expect.any(String),
        email_primary: dto.email,
        name: dto.name,
      };

      mockCorePersonRepository.findOne.mockResolvedValue(existingPerson);
      mockTenantRelationshipRepository.findOne.mockResolvedValue(null);
      mockTenantRelationshipRepository.create.mockReturnValue({
        id: 'rel-123',
        logline_id: existingPerson.logline_id,
        tenant_id: dto.tenant_id,
        role: 'customer',
      });
      mockTenantRelationshipRepository.save.mockResolvedValue({
        id: 'rel-123',
        logline_id: existingPerson.logline_id,
        tenant_id: dto.tenant_id,
      });

      const result = await service.register(dto);

      expect(result.created).toBe(false);
      expect(result.logline_id).toBe(existingPerson.logline_id);
    });

    it('should throw ConflictException if already linked to tenant', async () => {
      const dto: RegisterPersonDto = {
        cpf: '123.456.789-00',
        email: 'test@example.com',
        name: 'Test User',
        tenant_id: 'tenant-123',
      };

      const existingPerson = {
        logline_id: 'LL-BR-2024-000000001',
        cpf_hash: expect.any(String),
        email_primary: dto.email,
      };

      mockCorePersonRepository.findOne.mockResolvedValue(existingPerson);
      mockTenantRelationshipRepository.findOne.mockResolvedValue({
        id: 'rel-123',
        logline_id: existingPerson.logline_id,
        tenant_id: dto.tenant_id,
      });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findByLogLineId', () => {
    it('should return person by LogLine ID', async () => {
      const loglineId = 'LL-BR-2024-000000001';
      const person = {
        logline_id: loglineId,
        name: 'Test User',
        email_primary: 'test@example.com',
        tenant_relationships: [],
      };

      mockCorePersonRepository.findOne.mockResolvedValue(person);

      const result = await service.findByLogLineId(loglineId);

      expect(result).toEqual(person);
      expect(mockCorePersonRepository.findOne).toHaveBeenCalledWith({
        where: { logline_id: loglineId },
        relations: ['tenant_relationships'],
      });
    });

    it('should throw NotFoundException if person not found', async () => {
      mockCorePersonRepository.findOne.mockResolvedValue(null);

      await expect(service.findByLogLineId('LL-BR-2024-999999999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('should search people by criteria', async () => {
      const criteria = {
        email: 'test@example.com',
        tenant_id: 'tenant-123',
      };

      const people = [
        {
          logline_id: 'LL-BR-2024-000000001',
          name: 'Test User',
          email_primary: 'test@example.com',
        },
      ];

      mockCorePersonRepository.createQueryBuilder.mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(people),
      });

      const result = await service.search(criteria);

      expect(result).toEqual(people);
    });
  });

  describe('linkToTenant', () => {
    it('should link person to tenant', async () => {
      const loglineId = 'LL-BR-2024-000000001';
      const tenantId = 'tenant-123';
      const person = {
        logline_id: loglineId,
        name: 'Test User',
      };

      mockCorePersonRepository.findOne.mockResolvedValue(person);
      mockTenantRelationshipRepository.findOne.mockResolvedValue(null);
      mockTenantRelationshipRepository.create.mockReturnValue({
        id: 'rel-123',
        logline_id: loglineId,
        tenant_id: tenantId,
        role: 'employee',
      });
      mockTenantRelationshipRepository.save.mockResolvedValue({
        id: 'rel-123',
        logline_id: loglineId,
        tenant_id: tenantId,
        role: 'employee',
      });

      const result = await service.linkToTenant(loglineId, tenantId, 'employee');

      expect(result.logline_id).toBe(loglineId);
      expect(result.tenant_id).toBe(tenantId);
    });
  });

  describe('getTenants', () => {
    it('should return all tenants for a person', async () => {
      const loglineId = 'LL-BR-2024-000000001';
      const relationships = [
        {
          id: 'rel-1',
          logline_id: loglineId,
          tenant_id: 'tenant-1',
          role: 'customer',
        },
        {
          id: 'rel-2',
          logline_id: loglineId,
          tenant_id: 'tenant-2',
          role: 'employee',
        },
      ];

      mockCorePersonRepository.findOne.mockResolvedValue({
        logline_id: loglineId,
      });
      mockTenantRelationshipRepository.find.mockResolvedValue(relationships);

      const result = await service.getTenants(loglineId);

      expect(result).toEqual(relationships);
    });
  });
});

