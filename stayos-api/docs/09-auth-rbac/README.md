# Authentication, Sessions, and RBAC

StayOS uses a PMS-oriented authentication foundation for 24x7 hotel operations. The goal is to keep active staff productive while preserving session control, auditability, and role-based access.

## Roles

Roles are enum-backed: `OWNER`, `ADMIN`, `MANAGER`, `FRONT_DESK`, `HOUSEKEEPING`, `MAINTENANCE`, `ACCOUNTS`, and `READ_ONLY`.

## Permissions

Permissions are centralized in `src/core/auth/permissions.ts`; the role-permission matrix is in `src/core/auth/role-permissions.ts`.

Major permission groups include rooms, guests, bookings, arrival, check-in, check-out, stay, billing, housekeeping, maintenance, operations, reports, users, roles, settings, and sessions.

## Tokens

Access tokens are HMAC-signed JWTs with `sub`, `sessionId`, `propertyId`, `role`, `iat`, and `exp`. Refresh tokens are random opaque tokens; only SHA-256 refresh token hashes are stored.

Defaults:

```bash
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN_DAYS=14
SESSION_IDLE_LOCK_MINUTES=30
AUTH_ENABLED=true
```

Refresh rotates the refresh token on every successful call.

## Sessions

`user_sessions` tracks active, locked, revoked, and expired sessions with terminal name, IP address, user agent, last activity, and expiry.

If a session is idle longer than `SESSION_IDLE_LOCK_MINUTES`, refresh marks it `LOCKED` and returns `SESSION_LOCKED`. The user can unlock with `/api/v1/auth/unlock` using the refresh token and password.

## Endpoints

Public:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/unlock`

Authenticated:

- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Management:

- `GET /api/v1/properties/:propertyId/users`
- `GET /api/v1/properties/:propertyId/users/:userId`
- `POST /api/v1/properties/:propertyId/users`
- `PATCH /api/v1/properties/:propertyId/users/:userId`
- `GET /api/v1/properties/:propertyId/sessions`
- `PATCH /api/v1/properties/:propertyId/sessions/:sessionId/revoke`

## Protected Endpoint Groups

- Properties read: `settings.view`, `rooms.view`, or `operations.view`
- Properties write: `settings.manage`
- Floors and Room Types read: `rooms.view`
- Floors and Room Types write: `rooms.manage`
- Rooms read: `rooms.view`
- Room create/update: `rooms.manage`
- Room status mutations: `rooms.status.manage` or `rooms.manage`
- Guests read: `guests.view`
- Guests create/update: `guests.manage`
- Reservations read: `bookings.view`
- Reservations create/update: `bookings.manage`
- Assign/unassign room: `arrival.manage` or `bookings.manage`
- Check in: `checkin.manage`
- Check out: `checkout.manage`
- Operations read models: `operations.view` or `rooms.view`
- Users: `users.view` / `users.manage`
- Sessions: `sessions.view` / `sessions.manage`

## Demo Users

Run:

```bash
npm run bootstrap:demo-users
```

All demo users use `Password123!`.

- `owner@stayos.local`
- `admin@stayos.local`
- `manager@stayos.local`
- `frontdesk@stayos.local`
- `housekeeping@stayos.local`
- `maintenance@stayos.local`
- `accounts@stayos.local`
- `readonly@stayos.local`

The script assigns users to `HILLSTON_IND` when that Property exists. Demo credentials are local/dev only.

## Local Development

When `AUTH_ENABLED=false`, the global auth guard attaches a safe demo admin user. Do not use this in staging or production.

## Frontend Notes

Use `/auth/login` to get tokens, send access tokens as `Authorization: Bearer <token>`, refresh silently with `/auth/refresh`, and show password unlock UI when refresh returns `SESSION_LOCKED`. Use `/auth/me` to hydrate current user permissions.

## Future Enhancements

- Replace the internal PBKDF2 hasher with bcrypt or argon2 when dependency policy allows.
- Add password reset and invitations.
- Add full mutation audit coverage.
- Add property switching for multi-property users.
- Add MFA for owner/admin roles.
