# StayOS V1 RBAC

This document defines the V1 role-based access control model for StayOS. It is inspired by hotel PMS products such as eZee, but scoped to the operational workflows StayOS currently supports.

## Principles

- Roles provide the default access bundle for a staff responsibility.
- Permissions are the final authority for page visibility and backend API access.
- Frontend RBAC is for clarity and usability. Backend RBAC must still enforce security.
- V1 should keep roles simple. Custom role builders can come later.
- Language shown to staff should be operational, not technical.

## V1 Roles

| Role | Primary job | Default landing page |
| --- | --- | --- |
| `OWNER` | Full business ownership and system control | Front Desk |
| `ADMIN` | Full system administration | Front Desk |
| `MANAGER` | Property operations, reporting, and oversight | Front Desk |
| `FRONT_DESK` | Daily guest-facing operations | Front Desk |
| `ACCOUNTS` | Billing, folios, payments, and reports | Billing |
| `HOUSEKEEPING` | Cleaning board and room readiness | Housekeeping |
| `MAINTENANCE` | Maintenance tickets and room availability issues | Maintenance |
| `READ_ONLY` | View-only operational awareness | Front Desk |

## Who Can See What

| Area | Owner/Admin | Manager | Front Desk | Accounts | Housekeeping | Maintenance | Read Only |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Front Desk | Yes | Yes | Yes | No | No | No | Yes |
| Bookings | Yes | Yes | Yes | View | No | No | View |
| Rooms | Yes | Yes | Yes | No | View/status work if granted | View/status work if granted | View |
| Guests | Yes | Yes | Yes | View | No | No | View |
| Housekeeping | Yes | Yes | View | No | Yes | No | View |
| Maintenance | Yes | Yes | View | No | No | Yes | No |
| Billing | Yes | View | View/manage V1 payments | Yes | No | No | View |
| Reports | Yes | Yes | No | Yes | No | No | No |
| Employees | Yes | Yes | No | No | View if needed for assignment | No | View if explicitly granted |
| Settings | Yes | No by default | No | No | No | No | No |
| Marketplace | Admin-only for V1 | No | No | No | No | No | No |

## Demo Account Sidebar

These are the expected sidebar modules for V1 demo accounts:

| Demo account | Role | Sidebar modules |
| --- | --- | --- |
| `frontdesk@stayos.local` | `FRONT_DESK` | Front Desk, Bookings, Rooms, Guests, Housekeeping, Maintenance |
| `manager@stayos.local` | `MANAGER` | Front Desk, Bookings, Rooms, Guests, Housekeeping, Maintenance, Employees, Billing, Reports |
| `housekeeping@stayos.local` | `HOUSEKEEPING` | Housekeeping |
| `maintenance@stayos.local` | `MAINTENANCE` | Rooms, Maintenance |
| `accounts@stayos.local` | `ACCOUNTS` | Bookings, Guests, Billing, Reports |

All V1 demo accounts use:

```text
Password123!
```

Front Desk can still work with billing inside guest stay/check-in workflows where required, but the global Billing module is hidden for V1 to keep the desk experience focused.

## Operational Permissions

StayOS currently uses these permission keys as the core source of truth:

- Rooms: `rooms.view`, `rooms.manage`, `rooms.status.manage`
- Guests: `guests.view`, `guests.manage`, `guests.documents.manage`
- Bookings: `bookings.view`, `bookings.manage`, `bookings.cancel`
- Arrival/check-in/checkout: `arrival.manage`, `checkin.manage`, `checkout.manage`
- Stays: `stay.view`, `stay.manage`
- Billing: `billing.view`, `billing.manage`
- Housekeeping: `housekeeping.view`, `housekeeping.manage`
- Maintenance: `maintenance.view`, `maintenance.manage`
- Operations: `operations.view`, `operations.manage`
- Guest requests: `guest-requests.view`, `guest-requests.manage`
- Reports: `reports.view`
- Admin: `users.view`, `users.manage`, `roles.manage`, `settings.view`, `settings.manage`, `sessions.view`, `sessions.manage`

## Role Rules

### Owner/Admin

Can access every module and action, including settings, user management, billing, reports, overrides, and audit tools.

### Manager

Can oversee property operations:

- View and manage bookings, guests, rooms, stays, housekeeping, maintenance, and guest requests.
- View reports.
- View billing but does not get full billing management by default.
- View users/sessions for oversight.
- Should not manage system settings unless explicitly granted.

### Front Desk

Can run the daily front-office flow:

- Create and edit bookings.
- Use availability and group/block flows.
- Assign rooms, move rooms, check in, and check out.
- Update guest profiles and check-in registration details.
- View and manage stay workspace.
- View and manage V1 billing actions needed at the desk.
- View housekeeping/maintenance status so they can answer guests.

Restrictions:

- No reports by default.
- No settings by default.
- No employee directory or staff-management access by default.
- No user/role management.
- No marketplace in V1.
- Advanced financial controls such as refunds, voids, checked-out folio edits, and audit changes should become separate permissions before production.

### Accounts

Can manage money:

- View bookings, guests, stays, billing, and reports.
- Manage billing and folio settlement.
- Should not run room assignment or check-in operations by default.

### Housekeeping

Can manage room readiness:

- View rooms and housekeeping board.
- Update cleaning, inspection, and ready states.
- View assigned employees where needed.
- View guest requests connected to housekeeping.

Restrictions:

- No bookings, billing, guest documents, reports, or settings.
- Direct access to Rooms is redirected to Housekeeping in the current frontend.

### Maintenance

Can manage maintenance work:

- View rooms.
- View and manage maintenance tickets.
- Update operational status where allowed.
- View relevant guest requests.

Restrictions:

- No billing, bookings, reports, settings, or guest document workflows.

### Read Only

Can view operational data where granted, but cannot mutate records.

## Frontend V1 Enforcement

The app shell filters sidebar navigation using permissions, not just role names.

Some sidebar modules also have V1 role allow-lists:

- Global Billing is shown only to `OWNER`, `ADMIN`, `MANAGER`, and `ACCOUNTS`.
- Employees is shown only to `OWNER`, `ADMIN`, and `MANAGER`.

Current route checks:

- `/reservations` requires `bookings.view`
- `/rooms` requires `rooms.view`
- `/guests` requires `guests.view`
- `/guest-stay` requires `stay.view`
- `/housekeeping` requires `housekeeping.view`
- `/maintenance` requires `maintenance.view`
- `/billing` requires `billing.view`
- `/reports` requires `reports.view`
- `/settings/employees` requires `employees.view`
- `/settings` requires `settings.view`

Unauthorized staff are redirected to their default operational landing page.

## Backend V1 Enforcement

Backend controllers already use `RequirePermissions(...)` for core modules. Backend permissions remain the final authority even if a frontend button is hidden.

Important V1 gap:

- `billing.manage` is currently broad. For production, split it into narrower permissions such as `billing.collect`, `billing.post-charge`, `billing.refund`, `billing.void`, and `billing.edit-closed-folio`.
- `rooms.manage` is also broad. For production, split assignment, room moves, operational status, and room master-data edits.

## Release Checklist

- Confirm each demo account has the expected role.
- Confirm `/auth/me` returns role and permissions.
- Confirm the sidebar hides unavailable modules for each role.
- Confirm direct URL access redirects unauthorized users.
- Confirm backend APIs reject unauthorized calls.
- Confirm Front Desk always lands on `/` after login.
- Confirm Housekeeping cannot work from the general Rooms board.
- Confirm Accounts can reach Billing and Reports but not operational check-in flows.
