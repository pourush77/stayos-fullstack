import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../domain/user-role.enum';
import { PermissionsGuard } from './permissions.guard';
import { Permissions } from '../permissions';
import { getPermissionsForRole } from '../role-permissions';

const contextWithUser = (permissions: string[]): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        currentUser: { role: UserRole.FRONT_DESK, permissions },
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  it('allows users with any required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.CheckinManage]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(contextWithUser(getPermissionsForRole(UserRole.FRONT_DESK)))).toBe(
      true,
    );
  });

  it('denies users without required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.CheckinManage]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() =>
      guard.canActivate(contextWithUser(getPermissionsForRole(UserRole.HOUSEKEEPING))),
    ).toThrow(ForbiddenException);
  });
});
