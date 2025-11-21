import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { ApiKey } from './entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let sessionRepository: Repository<Session>;
  let apiKeyRepository: Repository<ApiKey>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockApiKeyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockAuditService = {
    logResourceChange: jest.fn().mockResolvedValue(undefined),
    logAuth: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    sessionRepository = module.get<Repository<Session>>(getRepositoryToken(Session));
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Test User';

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        email,
        password_hash: 'hashed',
        name,
        role: 'user',
      });
      mockUserRepository.save.mockResolvedValue({
        id: 'user-123',
        email,
        name,
        role: 'user',
      });
      mockJwtService.sign.mockReturnValue('access-token');
      mockSessionRepository.create.mockReturnValue({
        user_id: 'user-123',
        token_hash: 'hash',
        expires_at: new Date(),
      });
      mockSessionRepository.save.mockResolvedValue({});

      const result = await service.register(email, password, name);

      expect(result.user.email).toBe(email);
      expect(result.tokens.access_token).toBe('access-token');
      expect(result.tokens.refresh_token).toBeDefined();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user already exists', async () => {
      const email = 'existing@example.com';
      const password = 'password123';

      mockUserRepository.findOne.mockResolvedValue({ id: 'user-123', email });

      await expect(service.register(email, password)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = {
        id: 'user-123',
        email,
        password_hash: hashedPassword,
        role: 'user' as const,
      };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('access-token');
      mockSessionRepository.create.mockReturnValue({
        user_id: 'user-123',
        token_hash: 'hash',
        expires_at: new Date(),
      });
      mockSessionRepository.save.mockResolvedValue({});

      const result = await service.login(email, password);

      expect(result.user.email).toBe(email);
      expect(result.tokens.access_token).toBe('access-token');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        email,
        password_hash: hashedPassword,
      });

      await expect(service.login(email, password)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateToken', () => {
    it('should validate token and return user', async () => {
      const token = 'valid-token';
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const user = { id: 'user-123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(payload);
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await service.validateToken(token);

      expect(result).toEqual(user);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createApiKey', () => {
    it('should create API key successfully', async () => {
      const userId = 'user-123';
      const name = 'Test API Key';

      mockApiKeyRepository.create.mockReturnValue({
        user_id: userId,
        name,
        key_hash: 'hash',
      });
      mockApiKeyRepository.save.mockResolvedValue({
        id: 'key-123',
        user_id: userId,
        name,
        key_hash: 'hash',
      });

      const result = await service.createApiKey(userId, name);

      expect(result.apiKey.name).toBe(name);
      expect(result.key).toBeDefined();
      expect(result.key.startsWith('llm_')).toBe(true);
    });
  });
});

