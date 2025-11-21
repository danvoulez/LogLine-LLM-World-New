import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RbacService } from './rbac.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { ApiKey } from './entities/api-key.entity';
import { AuditModule } from '../audit/audit.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, ApiKey]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: '1h',
      },
    }),
    forwardRef(() => AuditModule), // Forward ref to avoid circular dependency
    RegistryModule, // Import RegistryModule to use PeopleService
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RbacService],
  exports: [AuthService, RbacService, JwtModule],
})
export class AuthModule {}

