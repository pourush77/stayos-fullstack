import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../domain/user-role.enum';
import { AuthService } from '../auth.service';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { getPermissionsForRole } from '../role-permissions';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.configService.get<boolean>('auth.enabled') === false) {
      request.currentUser = {
        id: '00000000-0000-0000-0000-000000000001',
        propertyId: null,
        name: 'Demo Admin',
        email: 'demo-admin@stayos.local',
        role: UserRole.ADMIN,
        permissions: getPermissionsForRole(UserRole.ADMIN),
        sessionId: '00000000-0000-0000-0000-000000000001',
      };

      return true;
    }

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    request.currentUser = await this.authService.validateAccessToken(token);

    return true;
  }
}
