import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, ApiKey])],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitingModule {}

