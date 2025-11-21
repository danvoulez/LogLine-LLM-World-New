import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateLimitService } from './rate-limit.service';
import { User } from '../auth/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';

describe('RateLimitService', () => {
  let service: RateLimitService;

  const mockUserRepository = {};
  const mockApiKeyRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUserLimit', () => {
    it('should allow request within limit', async () => {
      const result = await service.checkUserLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.limit).toBe(1000);
    });

    it('should deny request exceeding limit', async () => {
      const userId = 'user-123';

      // Exceed limit
      for (let i = 0; i < 1001; i++) {
        await service.checkUserLimit(userId);
      }

      const result = await service.checkUserLimit(userId);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('checkTenantLimit', () => {
    it('should allow request within tenant limit', async () => {
      const result = await service.checkTenantLimit('tenant-123');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10000);
    });
  });

  describe('checkIpLimit', () => {
    it('should allow request within IP limit', async () => {
      const result = await service.checkIpLimit('127.0.0.1');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired entries', async () => {
      // Create entries
      await service.checkUserLimit('user-123');

      // Manually expire by waiting (or we can test cleanup logic)
      service.cleanup();

      // Cleanup should not throw
      expect(() => service.cleanup()).not.toThrow();
    });
  });
});

