import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppScopeCheckerService } from './app-scope-checker.service';
import { AppScope, ScopeType } from '../entities/app-scope.entity';

describe('AppScopeCheckerService', () => {
  let service: AppScopeCheckerService;
  let appScopeRepository: Repository<AppScope>;

  const mockAppScopeRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppScopeCheckerService,
        {
          provide: getRepositoryToken(AppScope),
          useValue: mockAppScopeRepository,
        },
      ],
    }).compile();

    service = module.get<AppScopeCheckerService>(AppScopeCheckerService);
    appScopeRepository = module.get<Repository<AppScope>>(
      getRepositoryToken(AppScope),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkToolScope', () => {
    it('should return true if no app context (direct workflow run)', async () => {
      const result = await service.checkToolScope(undefined, 'some-tool');
      expect(result).toBe(true);
      expect(mockAppScopeRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return true if app has tool scope', async () => {
      const appId = 'test-app';
      const toolId = 'natural_language_db_read';

      mockAppScopeRepository.findOne.mockResolvedValue({
        id: 'scope-id',
        app_id: appId,
        scope_type: ScopeType.TOOL,
        scope_value: toolId,
      });

      const result = await service.checkToolScope(appId, toolId);
      expect(result).toBe(true);
      expect(mockAppScopeRepository.findOne).toHaveBeenCalledWith({
        where: {
          app_id: appId,
          scope_type: ScopeType.TOOL,
          scope_value: toolId,
        },
      });
    });

    it('should return false if app does not have tool scope', async () => {
      const appId = 'test-app';
      const toolId = 'unauthorized-tool';

      mockAppScopeRepository.findOne.mockResolvedValue(null);

      const result = await service.checkToolScope(appId, toolId);
      expect(result).toBe(false);
      expect(mockAppScopeRepository.findOne).toHaveBeenCalledWith({
        where: {
          app_id: appId,
          scope_type: ScopeType.TOOL,
          scope_value: toolId,
        },
      });
    });
  });

  describe('checkMemoryScope', () => {
    it('should return true if no app context', async () => {
      const result = await service.checkMemoryScope(undefined, 'memory-1');
      expect(result).toBe(true);
      expect(mockAppScopeRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return true if app has memory scope', async () => {
      const appId = 'test-app';
      const memoryId = 'memory-1';

      mockAppScopeRepository.findOne.mockResolvedValue({
        id: 'scope-id',
        app_id: appId,
        scope_type: ScopeType.MEMORY,
        scope_value: memoryId,
      });

      const result = await service.checkMemoryScope(appId, memoryId);
      expect(result).toBe(true);
    });

    it('should return false if app does not have memory scope', async () => {
      const appId = 'test-app';
      const memoryId = 'unauthorized-memory';

      mockAppScopeRepository.findOne.mockResolvedValue(null);

      const result = await service.checkMemoryScope(appId, memoryId);
      expect(result).toBe(false);
    });
  });

  describe('checkExternalScope', () => {
    it('should return true if no app context', async () => {
      const result = await service.checkExternalScope(undefined, 'external-1');
      expect(result).toBe(true);
    });

    it('should return true if app has external scope', async () => {
      const appId = 'test-app';
      const externalId = 'external-1';

      mockAppScopeRepository.findOne.mockResolvedValue({
        id: 'scope-id',
        app_id: appId,
        scope_type: ScopeType.EXTERNAL,
        scope_value: externalId,
      });

      const result = await service.checkExternalScope(appId, externalId);
      expect(result).toBe(true);
    });

    it('should return false if app does not have external scope', async () => {
      const appId = 'test-app';
      const externalId = 'unauthorized-external';

      mockAppScopeRepository.findOne.mockResolvedValue(null);

      const result = await service.checkExternalScope(appId, externalId);
      expect(result).toBe(false);
    });
  });

  describe('getAppScopes', () => {
    it('should return all scopes for an app', async () => {
      const appId = 'test-app';
      const scopes = [
        { id: '1', app_id: appId, scope_type: ScopeType.TOOL, scope_value: 'tool-1' },
        { id: '2', app_id: appId, scope_type: ScopeType.MEMORY, scope_value: 'memory-1' },
      ];

      mockAppScopeRepository.find.mockResolvedValue(scopes);

      const result = await service.getAppScopes(appId);
      expect(result).toEqual(scopes);
      expect(mockAppScopeRepository.find).toHaveBeenCalledWith({
        where: { app_id: appId },
      });
    });
  });
});

