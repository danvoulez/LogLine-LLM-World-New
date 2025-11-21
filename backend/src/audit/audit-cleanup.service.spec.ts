import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditCleanupService } from './audit-cleanup.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditCleanupService', () => {
  let service: AuditCleanupService;
  let auditLogRepository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditCleanupService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditCleanupService>(AuditCleanupService);
    auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanup', () => {
    it('should delete old audit logs', async () => {
      mockAuditLogRepository.delete.mockResolvedValue({ affected: 10 });

      const result = await service.cleanup();

      expect(result.deleted).toBe(10);
      expect(mockAuditLogRepository.delete).toHaveBeenCalled();
    });

    it('should return 0 if no logs deleted', async () => {
      mockAuditLogRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.cleanup();

      expect(result.deleted).toBe(0);
    });
  });

});

