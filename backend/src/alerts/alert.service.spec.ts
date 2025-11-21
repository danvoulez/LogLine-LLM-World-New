import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull } from 'typeorm';
import { AlertService } from './alert.service';
import { AlertConfig } from './entities/alert-config.entity';
import { AlertHistory } from './entities/alert-history.entity';
import { MetricsService } from '../metrics/metrics.service';
import { Run, RunStatus } from '../runs/entities/run.entity';
import { Event } from '../runs/entities/event.entity';

describe('AlertService', () => {
  let service: AlertService;
  let alertConfigRepository: Repository<AlertConfig>;
  let alertHistoryRepository: Repository<AlertHistory>;
  let metricsService: MetricsService;

  const mockAlertConfigRepository = {
    find: jest.fn(),
  };

  const mockAlertHistoryRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockMetricsService = {
    getMetricsSnapshot: jest.fn(),
  };

  const mockRunRepository = {
    count: jest.fn(),
  };

  const mockEventRepository = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: getRepositoryToken(AlertConfig),
          useValue: mockAlertConfigRepository,
        },
        {
          provide: getRepositoryToken(AlertHistory),
          useValue: mockAlertHistoryRepository,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: getRepositoryToken(Run),
          useValue: mockRunRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertConfigRepository = module.get<Repository<AlertConfig>>(getRepositoryToken(AlertConfig));
    alertHistoryRepository = module.get<Repository<AlertHistory>>(getRepositoryToken(AlertHistory));
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAlerts', () => {
    it('should check all enabled alerts', async () => {
      const configs: AlertConfig[] = [
        {
          id: 'config-1',
          name: 'Error Rate Alert',
          rule_type: 'error_rate',
          threshold: { value: 5, operator: 'gt' },
          enabled: true,
          channels: [],
          created_at: new Date(),
          updated_at: new Date(),
        } as AlertConfig,
      ];

      mockAlertConfigRepository.find.mockResolvedValue(configs);
      mockRunRepository.count.mockResolvedValue(100);
      mockAlertHistoryRepository.findOne.mockResolvedValue(null);
      mockAlertHistoryRepository.create.mockReturnValue({});
      mockAlertHistoryRepository.save.mockResolvedValue({});

      await service.checkAlerts();

      expect(mockAlertConfigRepository.find).toHaveBeenCalled();
    });

    it('should not trigger alert if threshold not exceeded', async () => {
      const configs: AlertConfig[] = [
        {
          id: 'config-1',
          name: 'Error Rate Alert',
          rule_type: 'error_rate',
          threshold: { value: 10, operator: 'gt' },
          enabled: true,
          channels: [],
          created_at: new Date(),
          updated_at: new Date(),
        } as AlertConfig,
      ];

      mockAlertConfigRepository.find.mockResolvedValue(configs);
      mockRunRepository.count.mockResolvedValue(100); // 0% error rate
      mockRunRepository.count.mockResolvedValueOnce(100).mockResolvedValueOnce(0); // 0 failed

      await service.checkAlerts();

      expect(mockAlertHistoryRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const updateSpy = jest.fn().mockResolvedValue({ affected: 1 });
      mockAlertHistoryRepository.update = updateSpy;

      await service.resolveAlert('alert-123');

      expect(updateSpy).toHaveBeenCalledWith(
        { id: 'alert-123' },
        { resolved_at: expect.any(Date) },
      );
    });
  });

  describe('cleanupOldAlerts', () => {
    it('should cleanup old alerts', async () => {
      mockAlertHistoryRepository.delete = jest.fn().mockResolvedValue({ affected: 5 });

      await service.cleanupOldAlerts();

      expect(mockAlertHistoryRepository.delete).toHaveBeenCalled();
    });
  });
});

