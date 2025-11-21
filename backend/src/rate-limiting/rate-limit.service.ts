import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';

export interface RateLimitConfig {
  limit: number; // Requests per window
  windowMs: number; // Window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly inMemoryStore = new Map<string, { count: number; resetAt: Date }>();

  // Default rate limits
  private readonly defaultLimits: RateLimitConfig = {
    limit: 100,
    windowMs: 60000, // 1 minute
  };

  private readonly userLimits: RateLimitConfig = {
    limit: 1000,
    windowMs: 60000, // 1 minute
  };

  private readonly tenantLimits: RateLimitConfig = {
    limit: 10000,
    windowMs: 60000, // 1 minute
  };

  private readonly apiKeyLimits: RateLimitConfig = {
    limit: 5000,
    windowMs: 60000, // 1 minute
  };

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  /**
   * Check rate limit for a user
   */
  async checkUserLimit(userId: string): Promise<RateLimitResult> {
    const key = `user:${userId}`;
    return this.checkLimit(key, this.userLimits);
  }

  /**
   * Check rate limit for a tenant
   */
  async checkTenantLimit(tenantId: string): Promise<RateLimitResult> {
    const key = `tenant:${tenantId}`;
    return this.checkLimit(key, this.tenantLimits);
  }

  /**
   * Check rate limit for an API key
   */
  async checkApiKeyLimit(apiKeyId: string): Promise<RateLimitResult> {
    const key = `apikey:${apiKeyId}`;
    return this.checkLimit(key, this.apiKeyLimits);
  }

  /**
   * Check rate limit for IP address (fallback)
   */
  async checkIpLimit(ipAddress: string): Promise<RateLimitResult> {
    const key = `ip:${ipAddress}`;
    return this.checkLimit(key, this.defaultLimits);
  }

  /**
   * Check rate limit with a key and config
   */
  private async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = new Date();
    const entry = this.inMemoryStore.get(key);

    if (!entry || now >= entry.resetAt) {
      // Create new window
      const resetAt = new Date(now.getTime() + config.windowMs);
      this.inMemoryStore.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: resetAt,
      };
    }

    // Increment count
    entry.count += 1;
    const allowed = entry.count <= config.limit;

    return {
      allowed,
      limit: config.limit,
      remaining: Math.max(0, config.limit - entry.count),
      reset: entry.resetAt,
    };
  }

  /**
   * Cleanup expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.inMemoryStore.entries()) {
      if (now >= entry.resetAt) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): RateLimitResult | null {
    const entry = this.inMemoryStore.get(key);
    if (!entry) {
      return null;
    }

    const config = this.getConfigForKey(key);
    return {
      allowed: entry.count <= config.limit,
      limit: config.limit,
      remaining: Math.max(0, config.limit - entry.count),
      reset: entry.resetAt,
    };
  }

  /**
   * Get config for a key based on prefix
   */
  private getConfigForKey(key: string): RateLimitConfig {
    if (key.startsWith('user:')) {
      return this.userLimits;
    }
    if (key.startsWith('tenant:')) {
      return this.tenantLimits;
    }
    if (key.startsWith('apikey:')) {
      return this.apiKeyLimits;
    }
    return this.defaultLimits;
  }
}

