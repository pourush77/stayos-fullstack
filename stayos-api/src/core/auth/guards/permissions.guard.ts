import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { Permission } from '../permissions';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().currentUser;
    const hasPermission = requiredPermissions.some((permission) =>
      user?.permissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
