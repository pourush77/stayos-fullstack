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
  it('keeps front desk away from employee directory permissions', () => {
    expect(getPermissionsForRole(UserRole.FRONT_DESK)).not.toContain(Permissions.EmployeesView);
    expect(getPermissionsForRole(UserRole.FRONT_DESK)).not.toContain(Permissions.EmployeesManage);
  });

  it('keeps demo role permission bundles aligned with V1 sidebar ownership', () => {
    expect(getPermissionsForRole(UserRole.MANAGER)).toEqual(
      expect.arrayContaining([
        Permissions.EmployeesView,
        Permissions.BillingView,
        Permissions.ReportsView,
      ]),
    );
    expect(getPermissionsForRole(UserRole.ACCOUNTS)).toEqual(
      expect.arrayContaining([Permissions.BillingView, Permissions.BillingManage, Permissions.ReportsView]),
    );
    expect(getPermissionsForRole(UserRole.HOUSEKEEPING)).toEqual(
      expect.arrayContaining([Permissions.HousekeepingView, Permissions.HousekeepingManage]),
    );
    expect(getPermissionsForRole(UserRole.MAINTENANCE)).toEqual(
      expect.arrayContaining([Permissions.MaintenanceView, Permissions.MaintenanceManage]),
    );
  });

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
