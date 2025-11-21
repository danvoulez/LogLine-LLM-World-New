import { Test, TestingModule } from '@nestjs/testing';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from './entities/policy.entity';
import { UseGuards } from '@nestjs/common';

describe('PoliciesController', () => {
  let controller: PoliciesController;
  let policiesService: PoliciesService;

  const mockPoliciesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoliciesController],
      providers: [
        {
          provide: PoliciesService,
          useValue: mockPoliciesService,
        },
        {
          provide: getRepositoryToken(Policy),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<PoliciesController>(PoliciesController);
    policiesService = module.get<PoliciesService>(PoliciesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all policies', async () => {
      const mockPolicies = [
        { id: 'policy-1', name: 'Policy 1' },
        { id: 'policy-2', name: 'Policy 2' },
      ];

      mockPoliciesService.findAll.mockResolvedValue(mockPolicies);

      const result = await controller.findAll();

      expect(result).toEqual(mockPolicies);
      expect(mockPoliciesService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a policy by id', async () => {
      const mockPolicy = { id: 'policy-1', name: 'Policy 1' };

      mockPoliciesService.findOne.mockResolvedValue(mockPolicy);

      const result = await controller.findOne('policy-1');

      expect(result).toEqual(mockPolicy);
      expect(mockPoliciesService.findOne).toHaveBeenCalledWith('policy-1');
    });
  });

  describe('create', () => {
    it('should create a new policy', async () => {
      const createDto = {
        name: 'New Policy',
        scope: 'global' as const,
        rule_expr: { conditions: [], logic: 'AND' as const },
        effect: 'allow' as const,
      };

      const mockPolicy = { id: 'policy-1', ...createDto };

      mockPoliciesService.create.mockResolvedValue(mockPolicy);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockPolicy);
      expect(mockPoliciesService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('update', () => {
    it('should update a policy', async () => {
      const updateDto = { name: 'Updated Policy' };
      const mockPolicy = { id: 'policy-1', name: 'Updated Policy' };

      mockPoliciesService.update.mockResolvedValue(mockPolicy);

      const result = await controller.update('policy-1', updateDto);

      expect(result).toEqual(mockPolicy);
      expect(mockPoliciesService.update).toHaveBeenCalledWith('policy-1', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a policy', async () => {
      mockPoliciesService.remove.mockResolvedValue(undefined);

      await controller.remove('policy-1');

      expect(mockPoliciesService.remove).toHaveBeenCalledWith('policy-1');
    });
  });
});

