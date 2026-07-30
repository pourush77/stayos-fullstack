# StayOS

StayOS is a hospitality operating system for independent Indian hotels. It combines reservations, rooms, guests, check-in, mobile document capture, housekeeping, maintenance, guest requests, billing, folios, reports, users, and role-based access in one monorepo.

## Stack

- Frontend: Next.js app router in `apps/web`
- Backend: NestJS in `stayos-api`
- Database: PostgreSQL
- ORM: TypeORM migrations
- Auth: JWT access and refresh tokens
- UI: Mantine, lucide-react, shared `@stayos/ui` and `@stayos/theme`

## Setup

Install dependencies from the repo root:

```bash
npm i
```

Create API env:

```bash
cp stayos-api/.env.example stayos-api/.env
```

Create web env:

```bash
echo NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 > apps/web/.env.local
```

Start PostgreSQL, then run migrations and demo seed from the API folder:

```bash
cd stayos-api
npm run migration:run
npm run bootstrap:demo
npm run start:dev
```

In another terminal, start the frontend from the repo root:

```bash
npm --workspace @stayos/web run dev
```

Open:

```text
http://localhost:3000
```

If API and web need different ports locally, run the API with a different `PORT` and update `apps/web/.env.local`.

## Environment Variables

API, in `stayos-api/.env`:

```text
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=stayos_dev
DATABASE_USERNAME=stayos
DATABASE_PASSWORD=StayOS@2026
TYPEORM_LOGGING=false
JWT_SECRET=supersecret
JWT_REFRESH_SECRET=superrefreshsecret
REDIS_HOST=localhost
REDIS_PORT=6379
```

Web, in `apps/web/.env.local`:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

## Useful Commands

```bash
npm --workspace @stayos/web run dev
npm --workspace @stayos/web run build
npm --workspace @stayos/web run typecheck
```

```bash
cd stayos-api
npm run start:dev
npm run migration:run
npm run migration:revert
npm run bootstrap:demo
npm test
npm run build
```

## API Base Paths

Local API base:

```text
http://localhost:3000/api/v1
```

Key paths:

- `/auth`
- `/health`
- `/properties`
- `/properties/:propertyId/floors`
- `/properties/:propertyId/rooms`
- `/properties/:propertyId/room-types`
- `/properties/:propertyId/amenities`
- `/properties/:propertyId/guests`
- `/properties/:propertyId/reservations`
- `/properties/:propertyId/stays`
- `/properties/:propertyId/housekeeping`
- `/properties/:propertyId/guest-requests`
- `/properties/:propertyId/maintenance`
- `/properties/:propertyId/reports`
- `/properties/:propertyId/folios`
- `/properties/:propertyId/users`
- `/properties/:propertyId/sessions`
- `/check-in-capture/:token`

## Permissions

Roles are mapped in `stayos-api/src/core/auth/role-permissions.ts`.

| Role | Access summary |
| --- | --- |
| Owner | All permissions |
| Admin | All permissions |
| Manager | Rooms, guests, bookings, arrivals, check-in/out, stays, billing view, housekeeping, employees, maintenance view, operations, guest requests, reports, users view, sessions view |
| Front Desk | Rooms, guests, bookings, arrivals, check-in/out, stays, billing, maintenance view, operations, guest requests |
| Housekeeping | Rooms view/status, housekeeping, employees view, operations, guest requests |
| Maintenance | Rooms view/status, maintenance, operations, guest requests |
| Accounts | Guests view, bookings view, stays view, billing, reports |
| Read Only | Read access to rooms, guests, bookings, stays, billing, housekeeping, employees, operations, guest requests |

## Documentation

- `docs/01_Product_Vision.md`
- `docs/02_PRD.md`
- `docs/03_Software_Architecture.md`
- `docs/04_Design_System.md`
- `docs/05_Development_Roadmap.md`
