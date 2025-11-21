import { Injectable, UnauthorizedException, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { ApiKey } from './entities/api-key.entity';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';

import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { PeopleService } from '../registry/people/people.service';

export interface JwtPayload {
  sub: string; // user_id
  logline_id?: string; // Registry Identity
  email: string;
  role: UserRole;
  tenant_id?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRY = 3600; // 1 hour
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 3600; // 7 days

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    private jwtService: JwtService,
    private peopleService: PeopleService,
    @Inject(forwardRef(() => AuditService))
    private auditService?: AuditService, // Optional to avoid circular dependency
  ) {}

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    name: string, // name is required now
    cpf: string, // cpf is required now
    tenantId?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // 1. Register Person in Registry first (Identity First)
    // If tenantId is provided, link person to tenant. If not, just create CorePerson.
    // If tenantId is missing, we might need a default tenant or just register without tenant link initially?
    // PeopleService.register requires tenant_id to create the initial relationship.
    // If we are creating a root user (no tenant yet), we might have an issue.
    // However, usually registration is within a context. Let's assume tenantId is provided or generated.
    // For public registration, maybe we use a 'public' tenant ID or allow register without tenant link?
    // Looking at PeopleService.register: it takes tenant_id as mandatory for the relationship.
    
    if (!tenantId) {
        // TODO: Handle tenant-less registration if allowed (e.g. SaaS sign up creates new tenant)
        // For now, we require tenantId or assume a default one should be handled by caller
        // Let's proceed assuming tenantId is required for this "Bridge" implementation
        throw new BadRequestException('Tenant ID is required for registration');
    }

    // Register/Find person in Registry
    const person = await this.peopleService.register({
        cpf,
        email,
        name,
        tenant_id: tenantId,
        role: 'admin', // Default role for new user registration? Or passed via DTO?
        // Assuming 'admin' for self-registered users for now, or 'employee'
    });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user linked to person
    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      name,
      tenant_id: tenantId,
      role: 'user',
      logline_id: person.logline_id, // LINKED!
    });

    const savedUser = await this.userRepository.save(user);

    // Log audit event
    if (this.auditService) {
      await this.auditService.logResourceChange(
        'create',
        'user',
        savedUser.id,
        savedUser.id,
        { after: { email: savedUser.email, role: savedUser.role } },
        savedUser.tenant_id,
      ).catch((err) => this.logger.warn(`Failed to log user creation: ${err.message}`));
    }

    // Generate tokens
    const tokens = await this.generateTokens(savedUser);

    return { user: savedUser, tokens };
  }

  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Find user
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    if (!user.password_hash) {
      throw new UnauthorizedException('User has no password set (OAuth only)');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed login attempt
      if (this.auditService) {
        await this.auditService.logAuth(
          'failed_login',
          undefined,
          email,
          ipAddress,
          userAgent,
          'Invalid password',
        ).catch((err) => this.logger.warn(`Failed to log failed login: ${err.message}`));
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // Log successful login
    if (this.auditService) {
      await this.auditService.logAuth(
        'login',
        user.id,
        user.email,
        ipAddress,
        userAgent,
      ).catch((err) => this.logger.warn(`Failed to log login: ${err.message}`));
    }

    // Generate tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return { user, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Find session by token hash
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepository.findOne({
      where: { token_hash: tokenHash },
      relations: ['user'],
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if session expired
    if (session.expires_at < new Date()) {
      await this.sessionRepository.remove(session);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(session.user);

    // Update session expiry
    session.expires_at = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000);
    await this.sessionRepository.save(session);

    return tokens;
  }

  /**
   * Logout (invalidate session)
   */
  async logout(refreshToken: string, userId?: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepository.findOne({
      where: { token_hash: tokenHash },
      relations: ['user'],
    });

    if (session) {
      const sessionUserId = session.user_id || userId;
      
      // Log logout
      if (this.auditService && sessionUserId) {
        await this.auditService.logAuth(
          'logout',
          sessionUserId,
          session.user?.email,
          session.ip_address,
          session.user_agent,
        ).catch((err) => this.logger.warn(`Failed to log logout: ${err.message}`));
      }

      await this.sessionRepository.remove(session);
    }
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get user by ID (for JWT strategy validation)
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
    });
  }

  /**
   * Get user from JWT token (without validation)
   */
  getUserFromToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  /**
   * Create API key for programmatic access
   */
  async createApiKey(
    userId: string,
    name: string,
    permissions: string[] = [],
    expiresAt?: Date,
  ): Promise<{ apiKey: ApiKey; key: string }> {
    // Generate API key
    const key = `llm_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashToken(key);

    const apiKey = this.apiKeyRepository.create({
      user_id: userId,
      name,
      key_hash: keyHash,
      permissions,
      expires_at: expiresAt,
    });

    const savedApiKey = await this.apiKeyRepository.save(apiKey);

    return { apiKey: savedApiKey, key };
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string): Promise<{ user: User; apiKey: ApiKey }> {
    const keyHash = this.hashToken(apiKey);
    const apiKeyRecord = await this.apiKeyRepository.findOne({
      where: { key_hash: keyHash },
      relations: ['user'],
    });

    if (!apiKeyRecord || !apiKeyRecord.user) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Check expiry
    if (apiKeyRecord.expires_at && apiKeyRecord.expires_at < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    // Update last_used_at asynchronously (non-blocking)
    // Only update if last update was more than 1 hour ago to reduce DB writes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!apiKeyRecord.last_used_at || apiKeyRecord.last_used_at < oneHourAgo) {
      // Fire and forget - don't block the request
      this.apiKeyRepository
        .update(apiKeyRecord.id, { last_used_at: new Date() })
        .catch((err) => this.logger.warn(`Failed to update API key last_used_at: ${err.message}`));
    }

    return { user: apiKeyRecord.user, apiKey: apiKeyRecord };
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: apiKeyId, user_id: userId },
    });

    if (!apiKey) {
      throw new BadRequestException('API key not found');
    }

    await this.apiKeyRepository.remove(apiKey);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      logline_id: user.logline_id, // Included in token
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    };

    // Generate access token
    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token
    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    // Create session
    const session = this.sessionRepository.create({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000),
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    await this.sessionRepository.save(session);

    return {
      access_token,
      refresh_token: refreshToken,
      expires_in: this.ACCESS_TOKEN_EXPIRY,
    };
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

