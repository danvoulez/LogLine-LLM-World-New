import { Injectable, ExecutionContext, HttpException, HttpStatus, CanActivate } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class EnhancedRateLimitGuard implements CanActivate {
  constructor(
    private rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    // Check user-specific rate limit if authenticated
    if (user) {
      const userLimit = await this.rateLimitService.checkUserLimit(user.sub);
      if (!userLimit.allowed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded for user',
            retryAfter: Math.ceil((userLimit.reset.getTime() - Date.now()) / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Set rate limit headers
      request.headers['x-ratelimit-limit'] = userLimit.limit.toString();
      request.headers['x-ratelimit-remaining'] = userLimit.remaining.toString();
      request.headers['x-ratelimit-reset'] = Math.floor(userLimit.reset.getTime() / 1000).toString();

      // Check tenant limit if tenant_id is available
      if (user.tenant_id) {
        const tenantLimit = await this.rateLimitService.checkTenantLimit(user.tenant_id);
        if (!tenantLimit.allowed) {
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: 'Rate limit exceeded for tenant',
              retryAfter: Math.ceil((tenantLimit.reset.getTime() - Date.now()) / 1000),
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    } else {
      // Fallback to IP-based rate limiting
      const ip = request.ip || request.connection.remoteAddress;
      if (ip) {
        const ipLimit = await this.rateLimitService.checkIpLimit(ip);
        if (!ipLimit.allowed) {
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: 'Rate limit exceeded',
              retryAfter: Math.ceil((ipLimit.reset.getTime() - Date.now()) / 1000),
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    // Allow request (ThrottlerGuard will handle global rate limiting)
    return true;
  }
}

