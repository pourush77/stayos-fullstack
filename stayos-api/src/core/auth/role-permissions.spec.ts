import { UserRole } from './domain/user-role.enum';
import { Permissions } from './permissions';
import { getPermissionsForRole } from './role-permissions';

describe('role billing permissions', () => {
  it('allows Front Desk normal billing but blocks sensitive financial actions', () => {
    const permissions = getPermissionsForRole(UserRole.FRONT_DESK);

    expect(permissions).toContain(Permissions.BillingView);
    expect(permissions).toContain(Permissions.BillingManage);

    expect(permissions).not.toContain(Permissions.BillingVoid);
    expect(permissions).not.toContain(Permissions.BillingRefund);
    expect(permissions).not.toContain(Permissions.BillingSettle);
  });

  it('allows Manager sensitive financial actions', () => {
    const permissions = getPermissionsForRole(UserRole.MANAGER);

    expect(permissions).toContain(Permissions.BillingManage);
    expect(permissions).toContain(Permissions.BillingVoid);
    expect(permissions).toContain(Permissions.BillingRefund);
    expect(permissions).toContain(Permissions.BillingSettle);
  });

  it('allows Accounts sensitive financial actions', () => {
    const permissions = getPermissionsForRole(UserRole.ACCOUNTS);

    expect(permissions).toContain(Permissions.BillingManage);
    expect(permissions).toContain(Permissions.BillingVoid);
    expect(permissions).toContain(Permissions.BillingRefund);
    expect(permissions).toContain(Permissions.BillingSettle);
  });

  describe('role night audit permissions', () => {
    it('grants night-audit.manage to OWNER, ADMIN, and MANAGER', () => {
      expect(getPermissionsForRole(UserRole.OWNER)).toContain(Permissions.NightAuditManage);
      expect(getPermissionsForRole(UserRole.ADMIN)).toContain(Permissions.NightAuditManage);
      expect(getPermissionsForRole(UserRole.MANAGER)).toContain(Permissions.NightAuditManage);
    });

    it('does NOT grant night-audit.manage to FRONT_DESK, ACCOUNTS, HOUSEKEEPING, MAINTENANCE, or READ_ONLY', () => {
      expect(getPermissionsForRole(UserRole.FRONT_DESK)).not.toContain(
        Permissions.NightAuditManage,
      );
      expect(getPermissionsForRole(UserRole.ACCOUNTS)).not.toContain(Permissions.NightAuditManage);
      expect(getPermissionsForRole(UserRole.HOUSEKEEPING)).not.toContain(
        Permissions.NightAuditManage,
      );
      expect(getPermissionsForRole(UserRole.MAINTENANCE)).not.toContain(
        Permissions.NightAuditManage,
      );
      expect(getPermissionsForRole(UserRole.READ_ONLY)).not.toContain(Permissions.NightAuditManage);
    });
  });
});
