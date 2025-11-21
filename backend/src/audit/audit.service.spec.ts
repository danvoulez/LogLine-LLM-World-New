import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log an audit event successfully', async () => {
      const input = {
        user_id: 'user-123',
        action: 'create' as const,
        resource_type: 'workflow' as const,
        resource_id: 'workflow-123',
      };

      const savedLog = {
        id: 'log-123',
        ...input,
        created_at: new Date(),
      };

      mockAuditLogRepository.create.mockReturnValue(input);
      mockAuditLogRepository.save.mockResolvedValue(savedLog);

      const result = await service.log(input);

      expect(result).toEqual(savedLog);
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(input);
      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });
  });

  describe('logAuth', () => {
    it('should log authentication event', async () => {
      const input = {
        user_id: 'user-123',
        action: 'login' as const,
        resource_type: 'auth' as const,
        resource_id: 'user-123',
        changes: { email: 'test@example.com' },
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
      };

      mockAuditLogRepository.create.mockReturnValue(input);
      mockAuditLogRepository.save.mockResolvedValue({ id: 'log-123', ...input });

      await service.logAuth('login', 'user-123', 'test@example.com', '127.0.0.1', 'test-agent');

      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });
  });

  describe('logResourceChange', () => {
    it('should log resource change event', async () => {
      const input = {
        user_id: 'user-123',
        action: 'update' as const,
        resource_type: 'workflow' as const,
        resource_id: 'workflow-123',
        changes: { before: { name: 'Old' }, after: { name: 'New' } },
      };

      mockAuditLogRepository.create.mockReturnValue(input);
      mockAuditLogRepository.save.mockResolvedValue({ id: 'log-123', ...input });

      await service.logResourceChange(
        'update',
        'workflow',
        'workflow-123',
        'user-123',
        { before: { name: 'Old' }, after: { name: 'New' } },
      );

      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });
  });

  describe('queryLogs', () => {
    it('should query logs with filters', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryLogs({
        user_id: 'user-123',
        resource_type: 'workflow',
        limit: 10,
      });

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockAuditLogRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });
});

