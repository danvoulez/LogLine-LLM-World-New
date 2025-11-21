import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ObjectsService } from './objects.service';
import { RegistryObject } from './entities/registry-object.entity';
import { RegistryObjectMovement } from './entities/registry-object-movement.entity';
import { CreateObjectDto } from './dto/create-object.dto';
import { TransferObjectDto } from './dto/transfer-object.dto';
import { NotFoundException } from '@nestjs/common';

describe('ObjectsService', () => {
  let service: ObjectsService;
  let objectRepository: Repository<RegistryObject>;
  let movementRepository: Repository<RegistryObjectMovement>;
  let dataSource: DataSource;

  const mockObjectRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    remove: jest.fn(),
  };

  const mockMovementRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback({ save: jest.fn().mockResolvedValue({}) })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObjectsService,
        {
          provide: getRepositoryToken(RegistryObject),
          useValue: mockObjectRepository,
        },
        {
          provide: getRepositoryToken(RegistryObjectMovement),
          useValue: mockMovementRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ObjectsService>(ObjectsService);
    objectRepository = module.get<Repository<RegistryObject>>(
      getRepositoryToken(RegistryObject),
    );
    movementRepository = module.get<Repository<RegistryObjectMovement>>(
      getRepositoryToken(RegistryObjectMovement),
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
    it('should create a new object', async () => {
      const dto: CreateObjectDto = {
        object_type: 'merchandise',
        name: 'Test Product',
        identifier: 'PROD-001',
        tenant_id: 'tenant-123',
      };

      const object = {
        id: 'obj-123',
        ...dto,
        visibility: 'tenant',
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockObjectRepository.create.mockReturnValue(object);
      mockObjectRepository.save.mockResolvedValue(object);

      const result = await service.create(dto);

      expect(result).toEqual(object);
      expect(mockObjectRepository.create).toHaveBeenCalledWith({
        ...dto,
        visibility: 'tenant',
        version: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should return object by ID', async () => {
      const object = {
        id: 'obj-123',
        name: 'Test Product',
        object_type: 'merchandise',
        movements: [],
      };

      mockObjectRepository.findOne.mockResolvedValue(object);

      const result = await service.findOne('obj-123');

      expect(result).toEqual(object);
    });

    it('should throw NotFoundException if object not found', async () => {
      mockObjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return filtered objects', async () => {
      const objects = [
        {
          id: 'obj-1',
          name: 'Product 1',
          object_type: 'merchandise',
        },
        {
          id: 'obj-2',
          name: 'Product 2',
          object_type: 'merchandise',
        },
      ];

      mockObjectRepository.createQueryBuilder.mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([objects, 2]),
      });

      const result = await service.findAll({
        object_type: 'merchandise',
        tenant_id: 'tenant-123',
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual(objects);
      expect(result.total).toBe(2);
    });
  });

  describe('transfer', () => {
    it('should transfer object to another person', async () => {
      const object = {
        id: 'obj-123',
        name: 'Test Product',
        current_custodian_logline_id: 'LL-BR-2024-000000001',
        location: 'Location A',
      };

      const dto: TransferObjectDto = {
        to_logline_id: 'LL-BR-2024-000000002',
        to_location: 'Location B',
        reason: 'Sale',
      };

      mockObjectRepository.findOne.mockResolvedValue(object);
      mockMovementRepository.create.mockReturnValue({
        id: 'mov-123',
        object_id: 'obj-123',
        movement_type: 'transfer',
      });

      const manager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(manager);
      });

      const result = await service.transfer('obj-123', dto);

      expect(result.object.current_custodian_logline_id).toBe(dto.to_logline_id);
      expect(result.object.location).toBe(dto.to_location);
      expect(result.movement.movement_type).toBe('transfer');
    });
  });

  describe('createMovement', () => {
    it('should create a movement record', async () => {
      const object = {
        id: 'obj-123',
        name: 'Test Product',
        current_custodian_logline_id: 'LL-BR-2024-000000001',
      };

      mockObjectRepository.findOne.mockResolvedValue(object);
      mockMovementRepository.create.mockReturnValue({
        id: 'mov-123',
        object_id: 'obj-123',
        movement_type: 'entry',
      });

      const manager = {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(manager);
      });

      const result = await service.createMovement('obj-123', {
        movement_type: 'entry',
        to_logline_id: 'LL-BR-2024-000000002',
        to_location: 'Warehouse',
      });

      expect(result.movement_type).toBe('entry');
    });
  });

  describe('getMovements', () => {
    it('should return movement history', async () => {
      const movements = [
        {
          id: 'mov-1',
          object_id: 'obj-123',
          movement_type: 'transfer',
          created_at: new Date(),
        },
      ];

      mockObjectRepository.findOne.mockResolvedValue({ id: 'obj-123' });
      mockMovementRepository.find.mockResolvedValue(movements);

      const result = await service.getMovements('obj-123');

      expect(result).toEqual(movements);
    });
  });
});

