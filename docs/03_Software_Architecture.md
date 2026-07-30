# Software Architecture

## Overview

StayOS is a TypeScript monorepo with a Next.js web app and a NestJS API. The backend is a modular monolith backed by PostgreSQL and TypeORM migrations. The frontend consumes REST APIs through `NEXT_PUBLIC_API_BASE_URL`.

## Monorepo Structure

- `apps/web`: Next.js app router frontend.
- `packages/ui`: shared shell, navigation, badges, cards, and UI components.
- `packages/theme`: shared colors, spacing, radius, and typography tokens.
- `packages/types`, `packages/utils`, `packages/config`: shared workspace packages.
- `stayos-api`: NestJS backend.
- `stayos-api/src/core`: domain modules.
- `stayos-api/src/database/migrations`: TypeORM migrations.
- `docs`: product, architecture, roadmap, and design documentation.

## Frontend Architecture

- Framework: Next.js app router.
- UI: Mantine components, lucide-react icons, shared `@stayos/ui` shell.
- Styling: shared `@stayos/theme` tokens plus scoped CSS modules where needed.
- Auth: browser stores access tokens and sends them to the API through helper clients.
- Route gating: app frame filters sidebar navigation by role and permissions.
- Feature folders: major workflows live under `apps/web/src/features`.

Important routes:

- `/`: front desk dashboard.
- `/reservations`: bookings list.
- `/rooms`: room operations.
- `/rooms/:roomId`: room detail with amenity badges.
- `/guests` and `/guests/:guestId`: guest profile and documents.
- `/check-in`: check-in workspace.
- `/check-in-capture/:token`: guest mobile document capture.
- `/guest-stay/:stayId`: stay workspace.
- `/requests`: guest requests.
- `/reports`: reports.
- `/maintenance`: maintenance tickets.
- `/settings`, `/settings/users`, `/settings/employees`, `/settings/room-types`.
- `/marketplace`: placeholder for integrations.

## Backend Architecture

The API is a NestJS modular monolith. Each module owns controllers, services, DTOs, entities, mappers, and tests where applicable.

Core modules shipped:

- `auth`
- `properties`
- `floors`
- `room-types`
- `rooms`
- `guests`
- `reservations`
- `operations`
- `employees`
- `housekeeping`
- `billing`
- `guest-requests`
- `reports`
- `maintenance`
- `amenities`

The default local API base URL is:

```text
http://localhost:3000/api/v1
```

## Data Architecture

- Database: PostgreSQL.
- ORM: TypeORM.
- Schema changes: explicit migrations under `stayos-api/src/database/migrations`.
- Tenant boundary: most tables include `property_id`; services and controllers scope reads and writes by property id.
- Many-to-many amenities: `room_type_amenities` links room types to amenities.
- Document uploads: local disk storage for guest identity documents in development.

## Authentication and Authorization

Authentication uses JWT access tokens and refresh tokens. Roles are mapped to explicit permissions in `stayos-api/src/core/auth/role-permissions.ts`.

Permission strings include:

- `rooms.view`, `rooms.manage`, `rooms.status.manage`
- `guests.view`, `guests.manage`, `guests.documents.manage`
- `bookings.view`, `bookings.manage`, `bookings.cancel`
- `arrival.manage`, `checkin.manage`, `checkout.manage`
- `stay.view`, `stay.manage`
- `billing.view`, `billing.manage`
- `housekeeping.view`, `housekeeping.manage`
- `employees.view`, `employees.manage`
- `maintenance.view`, `maintenance.manage`
- `operations.view`, `operations.manage`
- `guest-requests.view`, `guest-requests.manage`
- `reports.view`
- `users.view`, `users.manage`, `roles.manage`
- `settings.view`, `settings.manage`
- `sessions.view`, `sessions.manage`

Controller methods use `@RequirePermissions(...)`; the frontend also hides navigation and controls based on returned permissions.

## API Envelope

List endpoints commonly return:

```json
{
  "success": true,
  "message": "Records fetched successfully.",
  "data": [],
  "pagination": {}
}
```

Single-resource endpoints return DTOs directly or a standard success wrapper depending on module maturity. Frontend helpers unwrap `data`, `items`, or `results` for compatibility.

## Integration Architecture

Current integrations are internal only:

- Guest mobile document capture via tokenized public API.
- Local filesystem document storage.
- Recharts-based frontend reporting visualizations.

Planned integrations:

- Rate engine.
- Channel manager.
- Payment gateways.
- POS integrations.
- Event emission for audit/activity streams and downstream automation.

## Observability and Operations

- API logging uses `nestjs-pino`.
- Health endpoint: `GET /api/v1/health`.
- Tests are Jest specs focused on backend service behavior.
- Local setup uses migrations and demo bootstrap scripts instead of TypeORM synchronize.
