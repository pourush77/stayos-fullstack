# StayOS V1 Deployment Plan: Vercel + Render

This is the deployment direction for the Hillston staff pilot and the later production rollout.

## Decision

Use the same architecture for free pilot and paid production:

```text
Cloudflare DNS
   |
   |-- staging.stayos.in / app.stayos.in
   |      |
   |      v
   |   Vercel
   |   Next.js frontend
   |
   |-- api-staging.stayos.in / api.stayos.in
          |
          v
       Render Web Service
       NestJS API
          |
          v
       Render PostgreSQL
```

Why this plan:

- Low operational headache for a single maintainer.
- GitHub-based deploys.
- No VM patching or server maintenance.
- Easy rollback through Vercel and Render.
- Free/low-cost pilot now.
- Paid production later without changing the app architecture.

## URLs

Use real URLs from the pilot so staff habits do not need to change later.

Pilot:

```text
Frontend: https://staging.stayos.in
API:      https://api-staging.stayos.in/api/v1
```

Production:

```text
Frontend: https://app.stayos.in
API:      https://api.stayos.in/api/v1
```

Hillston staff should never use `localhost:3000`. They should use the staging or production frontend URL.

## Environments

Use two environments:

```text
staging     Staff pilot, demo data, disposable database
production  Real property data, paid database, backups enabled
```

Do not mix demo/staging data with production data.

## Important Cost Rule

Render free PostgreSQL is acceptable only for staff pilot and demos. It is not acceptable for real hotel data because free databases can expire or be limited.

Before real go-live:

- Upgrade PostgreSQL to a paid plan.
- Enable backups.
- Confirm restore process.
- Use production secrets.

## Current Deployment Files

```text
render.yaml
.env.staging.example
.env.production.example
docs/deployment-vercel-render.md
```

## Render API Deployment

Create a Render Blueprint from `render.yaml`, or manually create:

- Web Service: `stayos-api-staging`
- Root directory: `stayos-api`
- Runtime: Node
- Build command:

```bash
npm install && npm run build && npm run migration:run
```

- Start command:

```bash
node dist/main.js
```

- Health check:

```text
/api/v1/health/ready
```

Required Render API environment variables:

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
CORS_ORIGINS=https://staging.stayos.in,https://stayos-web-staging.vercel.app
JWT_SECRET=strong-random-secret-at-least-32-chars
JWT_REFRESH_SECRET=different-strong-random-secret-at-least-32-chars
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN_DAYS=14
SESSION_IDLE_LOCK_MINUTES=30
```

The API supports `DATABASE_URL` for hosted Postgres. Split database fields are still supported for local development.

## Database Setup

For staging:

1. Create Render PostgreSQL.
2. Attach `DATABASE_URL` to the API service.
3. Deploy API, which runs migrations.
4. Seed Hillston/demo data only after migrations pass.

Seed commands from `stayos-api`:

```bash
npm run bootstrap:demo
npm run bootstrap:demo-users
npm run bootstrap:demo-employees
```

Use demo seed data only for staging.

For production:

1. Create paid Render PostgreSQL.
2. Enable backups.
3. Run migrations.
4. Seed only required property setup data.
5. Create real users with secure passwords.
6. Do not load demo reservations or fake guests.

## Vercel Frontend Deployment

Create a Vercel project from the GitHub repo.

Recommended Vercel project settings:

```text
Framework: Next.js
Root directory: repository root
Install command: npm install
Build command: npm --workspace @stayos/web run build
```

Set frontend environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://api-staging.stayos.in/api/v1
NEXT_PUBLIC_API_PUBLIC_BASE_URL=https://api-staging.stayos.in/api/v1
NEXT_PUBLIC_APP_PUBLIC_ORIGIN=https://staging.stayos.in
NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false
```

For production, replace staging URLs with:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.stayos.in/api/v1
NEXT_PUBLIC_API_PUBLIC_BASE_URL=https://api.stayos.in/api/v1
NEXT_PUBLIC_APP_PUBLIC_ORIGIN=https://app.stayos.in
NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false
```

## Cloudflare DNS

Create DNS records:

```text
staging.stayos.in      -> Vercel
api-staging.stayos.in  -> Render
app.stayos.in          -> Vercel
api.stayos.in          -> Render
```

Use Vercel and Render custom-domain instructions for the exact CNAME targets.

## Smoke Tests Against Staging

After staging is deployed:

PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL="https://staging.stayos.in"
$env:PLAYWRIGHT_API_BASE_URL="https://api-staging.stayos.in/api/v1"
npm run test:e2e:release
npm run test:e2e:ops
```

Bash:

```bash
PLAYWRIGHT_BASE_URL=https://staging.stayos.in \
PLAYWRIGHT_API_BASE_URL=https://api-staging.stayos.in/api/v1 \
npm run test:e2e:release

PLAYWRIGHT_BASE_URL=https://staging.stayos.in \
PLAYWRIGHT_API_BASE_URL=https://api-staging.stayos.in/api/v1 \
npm run test:e2e:ops
```

## Staff Pilot Credentials

Staging demo accounts:

```text
frontdesk@stayos.local
manager@stayos.local
housekeeping@stayos.local
maintenance@stayos.local
accounts@stayos.local

Password123!
```

Change credentials before production.

## Production Go-Live Checklist

Do not go live with real property data until:

- Paid PostgreSQL is enabled.
- Backups are enabled.
- Restore has been tested once.
- Demo reservations/guests are not loaded.
- Production users have secure passwords.
- `CORS_ORIGINS` only includes production frontend URLs.
- `NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false`.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong and different.
- Health endpoint passes: `/api/v1/health/ready`.
- `npm run test:e2e:release` passes against production.
- `npm run test:e2e:ops` passes against production.

## Migration Path

Pilot to production should be an upgrade, not a rebuild:

1. Keep Vercel frontend.
2. Keep Render API.
3. Replace free/staging Postgres with paid production Postgres.
4. Update environment variables.
5. Run migrations.
6. Run smoke tests.
7. Move staff from `staging.stayos.in` to `app.stayos.in`.

## What Not To Do

- Do not use free Render Postgres for real hotel operations.
- Do not seed fake guests/reservations into production.
- Do not expose the API without strict CORS.
- Do not run destructive migrations during operating hours.
- Do not change deployment architecture during staff pilot unless there is a blocker.
