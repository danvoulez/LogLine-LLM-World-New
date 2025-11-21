import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoliciesService } from './policies.service';
import { Policy } from './entities/policy.entity';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let policyRepository: Repository<Policy>;

  const mockPolicyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesService,
        {
          provide: getRepositoryToken(Policy),
          useValue: mockPolicyRepository,
        },
      ],
    }).compile();

    service = module.get<PoliciesService>(PoliciesService);
    policyRepository = module.get<Repository<Policy>>(getRepositoryToken(Policy));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all policies', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          name: 'Test Policy',
          enabled: true,
        },
      ];

      mockPolicyRepository.find.mockResolvedValue(mockPolicies);

      const result = await service.findAll();

      expect(result).toEqual(mockPolicies);
      expect(mockPolicyRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a policy by id', async () => {
      const mockPolicy = {
        id: 'policy-1',
        name: 'Test Policy',
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);

      const result = await service.findOne('policy-1');

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
      });
    });
  });

  describe('create', () => {
    it('should create a new policy', async () => {
      const createDto = {
        name: 'New Policy',
        description: 'Test policy',
        scope: 'global' as const,
        rule_expr: {
          conditions: [
            {
              field: 'mode',
              operator: 'equals',
              value: 'draft',
            },
          ],
          logic: 'AND' as const,
        },
        effect: 'allow' as const,
        priority: 100,
      };

      const mockPolicy = {
        id: 'policy-1',
        ...createDto,
      };

      mockPolicyRepository.create.mockReturnValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy);

      const result = await service.create(createDto);

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepository.create).toHaveBeenCalled();
      expect(mockPolicyRepository.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a policy', async () => {
      const updateDto = {
        name: 'Updated Policy',
      };

      const existingPolicy = {
        id: 'policy-1',
        name: 'New Policy',
        description: 'Test policy',
        effect: 'allow' as const,
        priority: 100,
        rule_expr: {
          conditions: [
            {
              field: 'mode',
              operator: 'equals',
              value: 'draft',
            },
          ],
          logic: 'AND' as const,
        },
      };

      const updatedPolicy = { ...existingPolicy, name: 'Updated Policy' };

      mockPolicyRepository.findOne.mockResolvedValue(existingPolicy);
      mockPolicyRepository.save.mockResolvedValue(updatedPolicy);

      const result = await service.update('policy-1', updateDto);

      expect(result.name).toBe('Updated Policy');
      expect(result.id).toBe('policy-1');
      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
      });
      expect(mockPolicyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Policy' }),
      );
    });
  });

  describe('remove', () => {
    it('should delete a policy', async () => {
      const mockPolicy = {
        id: 'policy-1',
        name: 'Test Policy',
      };

      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockPolicyRepository.remove.mockResolvedValue(mockPolicy);

      await service.remove('policy-1');

      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
      });
      expect(mockPolicyRepository.remove).toHaveBeenCalledWith(mockPolicy);
    });
  });
});

