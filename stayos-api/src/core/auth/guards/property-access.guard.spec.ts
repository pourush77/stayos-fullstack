import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PropertyAccessGuard } from './property-access.guard';

describe('PropertyAccessGuard', () => {
  function createGuard(authEnabled = true) {
    const configService = {
      get: jest.fn().mockReturnValue(authEnabled),
    } as unknown as ConfigService;

    return new PropertyAccessGuard(configService);
  }

  function createContext(
    propertyId: string | undefined,
    userPropertyId: string | null,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params: propertyId ? { propertyId } : {},
          currentUser: {
            id: 'user-1',
            propertyId: userPropertyId,
            permissions: [],
          },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when user belongs to requested property', () => {
    const guard = createGuard();

    expect(guard.canActivate(createContext('property-a', 'property-a'))).toBe(true);
  });

  it('blocks access to another property', () => {
    const guard = createGuard();

    expect(() => guard.canActivate(createContext('property-b', 'property-a'))).toThrow(
      ForbiddenException,
    );
  });

  it('allows global user with null propertyId', () => {
    const guard = createGuard();

    expect(guard.canActivate(createContext('property-a', null))).toBe(true);
  });

  it('ignores routes without propertyId', () => {
    const guard = createGuard();

    expect(guard.canActivate(createContext(undefined, 'property-a'))).toBe(true);
  });

  it('allows requests in local mode when authentication is disabled', () => {
    const guard = createGuard(false);

    expect(guard.canActivate(createContext('property-b', 'property-a'))).toBe(true);
  });
});
