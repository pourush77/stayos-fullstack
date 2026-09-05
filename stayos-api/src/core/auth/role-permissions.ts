import { UserRole } from './domain/user-role.enum';
import { allPermissions, Permission, Permissions } from './permissions';

export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: allPermissions,

  [UserRole.ADMIN]: allPermissions,

  [UserRole.MANAGER]: [
    Permissions.RoomsView,
    Permissions.RoomsManage,
    Permissions.GuestsView,
    Permissions.GuestsManage,
    Permissions.BookingsView,
    Permissions.BookingsManage,
    Permissions.ArrivalManage,
    Permissions.CheckinManage,
    Permissions.CheckoutManage,
    Permissions.StayView,
    Permissions.StayManage,

    // Managers can perform normal billing operations and sensitive
    // financial actions requiring elevated authority.
    Permissions.BillingView,
    Permissions.BillingManage,
    Permissions.BillingVoid,
    Permissions.BillingRefund,
    Permissions.BillingSettle,

    Permissions.HousekeepingView,
    Permissions.HousekeepingManage,
    Permissions.EmployeesView,
    Permissions.EmployeesManage,
    Permissions.MaintenanceView,
    Permissions.MaintenanceReport,
    Permissions.OperationsView,
    Permissions.GuestRequestsView,
    Permissions.GuestRequestsManage,
    Permissions.ReportsView,
    Permissions.UsersView,
    Permissions.SessionsView,

    // Manager can view and configure property-level operational settings,
    // including rates and guest/child pricing policies.
    Permissions.SettingsView,
    Permissions.SettingsManage,

    // Manager can run and manage night audit
    Permissions.NightAuditManage,
  ],

  [UserRole.FRONT_DESK]: [
    Permissions.RoomsView,
    Permissions.RoomsManage,
    Permissions.GuestsView,
    Permissions.GuestsManage,
    Permissions.BookingsView,
    Permissions.BookingsManage,
    Permissions.ArrivalManage,
    Permissions.CheckinManage,
    Permissions.CheckoutManage,
    Permissions.StayView,
    Permissions.StayManage,

    // Front Desk can perform normal guest-facing billing operations,
    // but cannot void charges, issue refunds, or settle folios.
    Permissions.BillingView,
    Permissions.BillingManage,

    Permissions.HousekeepingView,

    // Front Desk can view maintenance information and report issues,
    // but cannot assign, resolve, cancel, or manage maintenance tickets.
    Permissions.MaintenanceView,
    Permissions.MaintenanceReport,

    Permissions.OperationsView,
    Permissions.GuestRequestsView,
    Permissions.GuestRequestsManage,
  ],

  [UserRole.HOUSEKEEPING]: [
    Permissions.RoomsView,
    Permissions.RoomsStatusManage,
    Permissions.HousekeepingView,
    Permissions.HousekeepingManage,
    Permissions.EmployeesView,
    Permissions.OperationsView,
    Permissions.GuestRequestsView,
    Permissions.GuestRequestsManage,
  ],

  [UserRole.MAINTENANCE]: [
    Permissions.RoomsView,
    Permissions.RoomsStatusManage,

    // Maintenance team has full maintenance workflow access.
    Permissions.MaintenanceView,
    Permissions.MaintenanceReport,
    Permissions.MaintenanceManage,

    Permissions.OperationsView,
    Permissions.GuestRequestsView,
    Permissions.GuestRequestsManage,
  ],

  [UserRole.ACCOUNTS]: [
    Permissions.GuestsView,
    Permissions.BookingsView,
    Permissions.StayView,

    // Accounts has full financial authority.
    Permissions.BillingView,
    Permissions.BillingManage,
    Permissions.BillingVoid,
    Permissions.BillingRefund,
    Permissions.BillingSettle,

    Permissions.ReportsView,
  ],

  [UserRole.READ_ONLY]: [
    Permissions.RoomsView,
    Permissions.GuestsView,
    Permissions.BookingsView,
    Permissions.StayView,
    Permissions.BillingView,
    Permissions.HousekeepingView,
    Permissions.EmployeesView,
    Permissions.OperationsView,
    Permissions.GuestRequestsView,
  ],
};

export const getPermissionsForRole = (role: UserRole): Permission[] => rolePermissions[role] ?? [];
