import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PropertyAccessGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    /*
     * Local/demo mode:
     *
     * JwtAuthGuard creates a Demo Admin with propertyId = null when
     * authentication is disabled. Property isolation must therefore
     * not block local development in that mode.
     */
    if (this.configService.get<boolean>('auth.enabled') === false) {
      return true;
    }

    const routePropertyId = request.params?.propertyId;

    /*
     * This guard only owns routes that explicitly contain :propertyId.
     *
     * Routes such as /auth/me, /health, etc. are outside this guard's
     * property-scoping responsibility.
     */
    if (!routePropertyId) {
      return true;
    }

    const user = request.currentUser;

    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    /*
     * A property-scoped user may only access their own property.
     */
    if (user.propertyId && user.propertyId !== routePropertyId) {
      throw new ForbiddenException('You do not have access to this property');
    }

    /*
     * propertyId === null currently represents an unscoped/global user
     * such as ADMIN.
     *
     * We deliberately allow it here. If StayOS later introduces explicit
     * multi-property assignments, this can evolve into membership-based
     * authorization without changing every controller.
     */
    return true;
  }
}
