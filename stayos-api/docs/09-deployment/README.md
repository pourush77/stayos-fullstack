# Deployment Documentation

This folder documents deployment architecture, infrastructure, and environment management.

## Required Runtime Services

- Node.js runtime compatible with the project TypeScript/NestJS version.
- PostgreSQL database reachable from the API runtime.

## Required Environment Variables

```bash
PORT=3000
NODE_ENV=production
DATABASE_HOST=postgres-host
DATABASE_PORT=5432
DATABASE_NAME=stayos
DATABASE_USERNAME=stayos_user
DATABASE_PASSWORD=change-me
TYPEORM_LOGGING=false
JWT_SECRET=replace-with-strong-secret-at-least-32-chars
JWT_REFRESH_SECRET=replace-with-different-strong-secret
```

`NODE_ENV` must be one of `development`, `test`, `staging`, or `production`.

`PORT`, `DATABASE_PORT`, and `REDIS_PORT` when provided must be valid TCP ports from `1` to `65535`.

Redis is not enabled yet, so `REDIS_HOST` and `REDIS_PORT` may be omitted until the Redis integration is introduced.

## Configuration Validation

The API validates environment configuration during startup. Invalid configuration stops the application before it begins serving traffic.

Production validation rejects weak JWT placeholders such as `secret`, `supersecret`, `superrefreshsecret`, `not-set`, and `change-me`.

## Database Deployment Rules

- Do not enable TypeORM `synchronize` in production.
- Run migrations explicitly during deployment.
- Keep database credentials in the deployment secret manager, not in source control.
- Verify the application logs the PostgreSQL connection success message during startup.

## Health Probes

Use these endpoints for deployment platforms and load balancers:

| Probe | Endpoint | Purpose |
| --- | --- | --- |
| Liveness | `GET /api/v1/health/live` | Confirms the Node.js process is running |
| Readiness | `GET /api/v1/health/ready` | Confirms PostgreSQL connectivity before routing traffic |
| General health | `GET /api/v1/health` | Frontend backend-availability contract |

Readiness should be used before routing traffic to a new instance.

Health endpoints return raw JSON and bypass the standard API success envelope.

`GET /api/v1/health` and `GET /api/v1/health/live` return `200`:

```json
{
  "status": "ok",
  "service": "StayOS Platform API",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "uptime": 1234
}
```

`GET /api/v1/health/ready` returns `200` when ready:

```json
{
  "status": "ready",
  "database": {
    "status": "connected"
  },
  "environment": "production",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "uptime": 1234
}
```

`GET /api/v1/health/ready` returns `503` when PostgreSQL is unavailable:

```json
{
  "status": "not_ready",
  "database": {
    "status": "disconnected"
  }
}
```

Health endpoints must never return stack traces, secrets, passwords, connection strings, or raw internal errors. `http://localhost:3000` is allowed as the local frontend CORS origin.

## Logging

- Startup logs identify app bootstrap and listening URL.
- PostgreSQL connection success and failure are logged without credentials.
- HTTP request logging is provided by `nestjs-pino`.
- Secrets must remain in the deployment secret manager and must not be logged.

## Deployment Checklist

- Install dependencies.
- Build the application with `npm run build`.
- Run pending migrations with `npm run migration:run`.
- For the first StayOS property, run `npm run bootstrap:hillston`.
- Start the compiled NestJS application.
- Confirm `/api/v1/health` responds.
- Confirm `/api/v1/health/live` responds.
- Confirm `/api/v1/health/ready` responds before routing traffic.
- Confirm Swagger is available only where appropriate for the environment.

## Property Bootstrap

`npm run bootstrap:hillston` creates or updates the first production property, Hillston Resort & Club.

The bootstrap is transactional and idempotent. It validates the expected inventory counts before completing.

Required order:

1. `npm run migration:run`
2. `npm run bootstrap:hillston`
3. `npm run verify:hillston`

## Inventory Verification

Before frontend integration, verify the seeded Hillston inventory:

```bash
npm run verify:hillston
```

Expected result:

| Check | Expected |
| --- | --- |
| Property Name | Hillston Resort & Club |
| Floors Count | 2 |
| Room Types Count | 2 |
| Rooms Count | 24 |
| Deluxe Count | 20 |
| Suite Count | 4 |

The verifier also checks the generated Swagger document includes the Hotel Inventory list endpoints.
