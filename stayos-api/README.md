# StayOS Platform API

StayOS Platform API is the backend foundation for the StayOS hospitality ecosystem. It is a modular NestJS service with PostgreSQL, TypeORM, environment-based configuration, structured logging, validation, Swagger documentation, and automated tests.

## Technology Stack

- NestJS with TypeScript
- PostgreSQL
- TypeORM and `@nestjs/typeorm`
- `@nestjs/config`
- `class-validator` and `class-transformer`
- `nestjs-pino`
- Swagger
- Helmet
- Jest
- ESLint and Prettier

## Architecture Philosophy

StayOS Platform API is designed around:

- clear module boundaries
- clean architecture separation
- configuration via environment variables
- explicit database migrations
- centralized logging
- API versioning and documentation
- secure HTTP defaults
- production-ready extension points for authentication, caching, queues, and realtime workflows

## Database Configuration

The API connects to PostgreSQL through TypeORM. Runtime schema synchronization is disabled.

The application validates environment configuration during startup and fails fast when required values are missing or invalid.

Required environment variables:

```bash
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=stayos
DATABASE_USERNAME=stayos_user
DATABASE_PASSWORD=secret
JWT_SECRET=supersecret
JWT_REFRESH_SECRET=superrefreshsecret
```

Optional:

```bash
TYPEORM_LOGGING=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

Supported `NODE_ENV` values are `development`, `test`, `staging`, and `production`.

`PORT` and `DATABASE_PORT` must be valid TCP ports. JWT secrets may be placeholders outside production, but production secrets must be non-placeholder values with at least 32 characters.

## Migration Commands

Create a blank migration:

```bash
npm run migration:create -- src/database/migrations/MigrationName
```

Generate a migration from entity metadata:

```bash
npm run migration:generate -- src/database/migrations/MigrationName
```

Run pending migrations:

```bash
npm run migration:run
```

Revert the latest migration:

```bash
npm run migration:revert
```

## Folder Structure

- `src/app.module.ts` - root NestJS module
- `src/main.ts` - HTTP bootstrap, validation, Swagger, and security middleware
- `src/common/` - shared filters and framework-level utilities
- `src/core/` - core platform modules
- `src/database/` - TypeORM configuration, CLI data source, migrations, and seeds
- `docs/` - architecture and product documentation

## Getting Started

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:

```bash
npm install
```

3. Ensure PostgreSQL is running and the configured database exists.
4. Start the app in development mode:

```bash
npm run start:dev
```

On successful startup, the API logs a PostgreSQL connection message and serves HTTP at `/api/v1`.

## Local Docker Setup

Use Docker for local PostgreSQL and pgAdmin. The NestJS API still runs directly on your machine.

Start PostgreSQL and pgAdmin:

```bash
docker compose up -d
```

Local PostgreSQL connection:

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=stayos_dev
DATABASE_USERNAME=stayos
DATABASE_PASSWORD=StayOS@2026
```

pgAdmin is available at `http://localhost:5050`.

pgAdmin login:

```text
Email: admin@stayos.com
Password: admin123
```

Register the database server in pgAdmin with:

```text
Host: postgres
Port: 5432
Database: stayos_dev
Username: stayos
Password: StayOS@2026
```

One-command local setup:

```bash
npm run setup:dev
```

This starts Docker services, installs dependencies, runs migrations, and bootstraps Hillston inventory.

To resync an existing local database after code updates:

```bash
npm run sync:dev
```

Start the API after setup:

```bash
npm run start:dev
```

## Health and Observability

Health endpoints are available under the versioned API prefix:

- `GET /api/v1/health` - backend health contract.
- `GET /api/v1/health/live` - process liveness for restart checks.
- `GET /api/v1/health/ready` - readiness check for traffic routing.

Health endpoints return raw health payloads, not the standard API success envelope, so frontend availability checks can consume them directly.

`GET /api/v1/health` and `GET /api/v1/health/live` return:

```json
{
  "status": "ok",
  "service": "StayOS Platform API",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "uptime": 1234
}
```

`GET /api/v1/health/ready` returns `200` when PostgreSQL is reachable:

```json
{
  "status": "ready",
  "database": {
    "status": "connected"
  },
  "environment": "development",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "uptime": 1234
}
```

When PostgreSQL is unavailable, readiness returns `503`:

```json
{
  "status": "not_ready",
  "database": {
    "status": "disconnected"
  }
}
```

Secrets, stack traces, connection strings, passwords, and internal database errors are never returned from health endpoints. `http://localhost:3000` is allowed as a frontend CORS origin.

Request logging is handled by `nestjs-pino`. Startup logs include application bootstrap and PostgreSQL connection success or failure without exposing credentials.

## API Errors and Request IDs

Every request receives an `x-request-id` response header. If the client sends `x-request-id`, the API preserves it; otherwise the API generates a UUID.

Errors use a consistent JSON shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [],
    "path": "/api/v1/properties",
    "method": "POST",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "requestId": "request-id"
  }
}
```

Production errors never expose stack traces.

## API Success Responses

Successful responses use a consistent envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {},
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "version": "v1"
  }
}
```

List responses may include pagination metadata when the client explicitly requests pagination.

Without pagination:

```json
{
  "success": true,
  "message": "Records fetched successfully.",
  "data": [],
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "version": "v1"
  }
}
```

With pagination:

```json
{
  "success": true,
  "message": "Records fetched successfully.",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "meta": {
    "requestId": "request-id",
    "timestamp": "2026-06-30T00:00:00.000Z",
    "version": "v1"
  }
}
```

Pagination is only applied when both `page` and `limit` are provided. Future list endpoints should use `page`, `limit`, `sortBy`, `sortOrder`, and `search` query parameters.

## Hillston Bootstrap

Hillston Resort & Club is the first real StayOS property dataset.

Run after migrations:

```bash
npm run bootstrap:hillston
```

The script is transactional and idempotent. It creates or updates the Property, Floors, Room Types, and Rooms without duplicates, then verifies the expected inventory counts.

Amenities are skipped until Amenity and RoomTypeAmenity entities are implemented. The TODO is documented in `docs/02-domain/hotel-inventory-amenities-todo.md`.

Verify the seeded data:

```bash
npm run verify:hillston
```

The verifier checks database tables, Hillston inventory counts, and Swagger paths for the Hotel Inventory GET endpoints.

Seed Hillston guest profiles for frontend Guest Profile testing:

```bash
npm run bootstrap:guests
```

The guest bootstrap is transactional and idempotent. It upserts five Hillston guests by `propertyId + phone`, including two VIP guests, and verifies the final guest counts.

Seed Hillston reservations for frontend Reservations, Check-in, and Guest Stay testing:

```bash
npm run bootstrap:reservations
```

The reservation bootstrap is transactional and idempotent. It upserts five reservations by `reservationCode`, including three confirmed bookings, one pending booking, one checked-in stay, three assigned rooms, and two unassigned room-type bookings.

## Guests

Guests are implemented as a property-scoped core module for future reservations, check-in, stays, billing, guest history, and AI search.

Endpoints:

- `GET /api/v1/properties/:propertyId/guests`
- `GET /api/v1/properties/:propertyId/guests/:id`
- `POST /api/v1/properties/:propertyId/guests`
- `PATCH /api/v1/properties/:propertyId/guests/:id`

Guest list endpoints support `page`, `limit`, `sortBy`, `sortOrder`, and `search`. Pagination is applied only when both `page` and `limit` are provided. Phone numbers are unique within a Property.

## Reservations

Reservations are implemented as a property-scoped PMS module for booking creation, arrivals, check-in readiness, room assignment, and future billing.

Endpoints:

- `GET /api/v1/properties/:propertyId/reservations`
- `GET /api/v1/properties/:propertyId/reservations/:id`
- `POST /api/v1/properties/:propertyId/reservations`
- `PATCH /api/v1/properties/:propertyId/reservations/:id`

Reservation list endpoints support optional pagination, allowlisted sorting, and search by reservation code, guest name, or guest phone. Reservation creation validates that the Guest, Room Type, and optional Room all belong to the same Property.

## Development Commands

- `npm run start:dev` - start NestJS with hot reload
- `npm run lint` - run ESLint
- `npm run format` - format TypeScript files with Prettier
- `npm run test` - run Jest tests
- `npm run build` - compile TypeScript into `dist`
- `npm run bootstrap:hillston` - create or update the Hillston property inventory
- `npm run bootstrap:guests` - create or update Hillston guest profile seed data
- `npm run bootstrap:reservations` - create or update Hillston reservation seed data
- `npm run verify:hillston` - verify Hillston database counts and Swagger inventory paths

## Documentation

Swagger UI is available at `/docs` when the application is running.

Markdown documentation is kept under `docs/` and must be updated whenever implementation changes affect the API, architecture, database, deployment, security, events, integrations, or workflows.
