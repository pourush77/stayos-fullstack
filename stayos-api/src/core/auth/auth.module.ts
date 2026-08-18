import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PropertyAccessGuard } from './guards/property-access.guard';
import { UserSessionEntity } from './infrastructure/user-session.entity';
import { UserEntity } from './infrastructure/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionsController } from './sessions.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([UserEntity, UserSessionEntity])],
  controllers: [AuthController, UsersController, SessionsController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordService,
    RefreshTokenService,

    // 1. Authenticate the request and populate request.currentUser.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // 2. Enforce property isolation for routes containing :propertyId.
    {
      provide: APP_GUARD,
      useClass: PropertyAccessGuard,
    },

    // 3. Enforce endpoint-level permissions.
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
