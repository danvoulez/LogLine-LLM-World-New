import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { ApiKey } from './entities/api-key.entity';
import { AuditService } from '../audit/audit.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getUserById: jest.fn(),
    createApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      };

      mockAuthService.register.mockResolvedValue({
        user: { ...mockUser, password_hash: 'hashed' },
        tokens: mockTokens,
      });

      const result = await controller.register(registerDto);

      expect(result.user.email).toBe(registerDto.email);
      expect(result.access_token).toBe('access-token');
      expect(result.user.password_hash).toBeUndefined();
      expect(mockAuthService.register).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.name,
        undefined,
      );
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      };

      mockAuthService.login.mockResolvedValue({
        user: { ...mockUser, password_hash: 'hashed' },
        tokens: mockTokens,
      });

      const result = await controller.login(loginDto, {});

      expect(result.user.email).toBe(loginDto.email);
      expect(result.access_token).toBe('access-token');
      expect(mockAuthService.login).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const mockJwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser);

      const result = await controller.getCurrentUser(mockJwtPayload);

      expect(result.email).toBe('test@example.com');
      expect(result.password_hash).toBeUndefined();
      expect(mockAuthService.getUserById).toHaveBeenCalledWith('user-123');
    });
  });

  describe('createApiKey', () => {
    it('should create API key', async () => {
      const createDto = {
        name: 'Test API Key',
        permissions: ['read', 'write'],
      };

      const mockJwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const mockApiKey = {
        id: 'key-123',
        name: 'Test API Key',
        permissions: ['read', 'write'],
      };

      mockAuthService.createApiKey.mockResolvedValue({
        apiKey: mockApiKey,
        key: 'llm_abc123',
      });

      const result = await controller.createApiKey(mockJwtPayload, createDto);

      expect(result.name).toBe('Test API Key');
      expect(result.key).toBe('llm_abc123');
      expect(mockAuthService.createApiKey).toHaveBeenCalledWith(
        'user-123',
        'Test API Key',
        ['read', 'write'],
        undefined,
      );
    });
  });
});

