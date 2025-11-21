import { Test, TestingModule } from '@nestjs/testing';
import { CronService } from './cron.service';
import { AlertService } from '../alerts/alert.service';
import { AuditCleanupService } from '../audit/audit-cleanup.service';
import { RateLimitService } from '../rate-limiting/rate-limit.service';

describe('CronService', () => {
  let service: CronService;
  let alertService: AlertService;
  let auditCleanupService: AuditCleanupService;
  let rateLimitService: RateLimitService;

  const mockAlertService = {
    checkAlerts: jest.fn().mockResolvedValue(undefined),
    cleanupOldAlerts: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditCleanupService = {
    cleanup: jest.fn().mockResolvedValue({ deleted: 10 }),
  };

  const mockRateLimitService = {
    cleanup: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
        {
          provide: AuditCleanupService,
          useValue: mockAuditCleanupService,
        },
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
    alertService = module.get<AlertService>(AlertService);
    auditCleanupService = module.get<AuditCleanupService>(AuditCleanupService);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleAlertCheck', () => {
    it('should check alerts', async () => {
      await service.handleAlertCheck();

      expect(mockAlertService.checkAlerts).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockAlertService.checkAlerts.mockRejectedValueOnce(new Error('Test error'));

      await expect(service.handleAlertCheck()).resolves.not.toThrow();
    });
  });

  describe('handleAuditCleanup', () => {
    it('should cleanup old audit logs', async () => {
      await service.handleAuditCleanup();

      expect(mockAuditCleanupService.cleanup).toHaveBeenCalled();
    });
  });

  describe('handleAlertHistoryCleanup', () => {
    it('should cleanup old alert history', async () => {
      await service.handleAlertHistoryCleanup();

      expect(mockAlertService.cleanupOldAlerts).toHaveBeenCalled();
    });
  });

  describe('handleRateLimitCleanup', () => {
    it('should cleanup rate limit store', async () => {
      await service.handleRateLimitCleanup();

      expect(mockRateLimitService.cleanup).toHaveBeenCalled();
    });
  });
});

