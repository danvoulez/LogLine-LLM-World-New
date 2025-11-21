import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RelationshipsService } from './relationships.service';
import { RegistryRelationship } from './entities/registry-relationship.entity';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('RelationshipsService', () => {
  let service: RelationshipsService;
  let relationshipRepository: Repository<RegistryRelationship>;

  const mockRelationshipRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipsService,
        {
          provide: getRepositoryToken(RegistryRelationship),
          useValue: mockRelationshipRepository,
        },
      ],
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
    relationshipRepository = module.get<Repository<RegistryRelationship>>(
      getRepositoryToken(RegistryRelationship),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new relationship', async () => {
      const dto: CreateRelationshipDto = {
        source_type: 'person',
        source_id: 'LL-BR-2024-000000001',
        target_type: 'object',
        target_id: 'obj-123',
        relationship_type: 'owns',
      };

      const relationship = {
        id: 'rel-123',
        ...dto,
        created_at: new Date(),
      };

      mockRelationshipRepository.findOne.mockResolvedValue(null);
      mockRelationshipRepository.create.mockReturnValue(relationship);
      mockRelationshipRepository.save.mockResolvedValue(relationship);

      const result = await service.create(dto);

      expect(result).toEqual(relationship);
    });

    it('should throw ConflictException if relationship already exists', async () => {
      const dto: CreateRelationshipDto = {
        source_type: 'person',
        source_id: 'LL-BR-2024-000000001',
        target_type: 'object',
        target_id: 'obj-123',
        relationship_type: 'owns',
      };

      mockRelationshipRepository.findOne.mockResolvedValue({
        id: 'rel-123',
        ...dto,
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findBySource', () => {
    it('should return relationships by source', async () => {
      const relationships = [
        {
          id: 'rel-1',
          source_type: 'person',
          source_id: 'LL-BR-2024-000000001',
          target_type: 'object',
          target_id: 'obj-123',
          relationship_type: 'owns',
        },
      ];

      mockRelationshipRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(relationships),
      });

      const result = await service.findBySource('person', 'LL-BR-2024-000000001');

      expect(result).toEqual(relationships);
    });
  });

  describe('findByTarget', () => {
    it('should return relationships by target', async () => {
      const relationships = [
        {
          id: 'rel-1',
          source_type: 'person',
          source_id: 'LL-BR-2024-000000001',
          target_type: 'object',
          target_id: 'obj-123',
          relationship_type: 'owns',
        },
      ];

      mockRelationshipRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(relationships),
      });

      const result = await service.findByTarget('object', 'obj-123');

      expect(result).toEqual(relationships);
    });
  });

  describe('findBetween', () => {
    it('should return relationships between two entities', async () => {
      const relationships = [
        {
          id: 'rel-1',
          source_type: 'person',
          source_id: 'LL-BR-2024-000000001',
          target_type: 'object',
          target_id: 'obj-123',
          relationship_type: 'owns',
        },
      ];

      mockRelationshipRepository.find.mockResolvedValue(relationships);

      const result = await service.findBetween(
        'person',
        'LL-BR-2024-000000001',
        'object',
        'obj-123',
      );

      expect(result).toEqual(relationships);
    });
  });

  describe('getEntityRelationships', () => {
    it('should return both outgoing and incoming relationships', async () => {
      const outgoing = [
        {
          id: 'rel-1',
          source_type: 'person',
          source_id: 'LL-BR-2024-000000001',
          target_type: 'object',
          target_id: 'obj-123',
          relationship_type: 'owns',
        },
      ];

      const incoming = [
        {
          id: 'rel-2',
          source_type: 'agent',
          source_id: 'agent-123',
          target_type: 'person',
          target_id: 'LL-BR-2024-000000001',
          relationship_type: 'created',
        },
      ];

      mockRelationshipRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValueOnce(outgoing)
          .mockResolvedValueOnce(incoming),
      });

      const result = await service.getEntityRelationships(
        'person',
        'LL-BR-2024-000000001',
      );

      expect(result.outgoing).toEqual(outgoing);
      expect(result.incoming).toEqual(incoming);
    });
  });

  describe('remove', () => {
    it('should delete a relationship', async () => {
      const relationship = {
        id: 'rel-123',
        source_type: 'person',
        source_id: 'LL-BR-2024-000000001',
        target_type: 'object',
        target_id: 'obj-123',
      };

      mockRelationshipRepository.findOne.mockResolvedValue(relationship);
      mockRelationshipRepository.remove.mockResolvedValue(relationship);

      await service.remove('rel-123');

      expect(mockRelationshipRepository.remove).toHaveBeenCalledWith(relationship);
    });
  });

  describe('updateMetadata', () => {
    it('should update relationship metadata', async () => {
      const relationship = {
        id: 'rel-123',
        metadata: { key: 'value' },
      };

      mockRelationshipRepository.findOne.mockResolvedValue(relationship);
      mockRelationshipRepository.save.mockResolvedValue({
        ...relationship,
        metadata: { key: 'value', newKey: 'newValue' },
      });

      const result = await service.updateMetadata('rel-123', { newKey: 'newValue' });

      expect(result.metadata).toEqual({ key: 'value', newKey: 'newValue' });
    });
  });
});

