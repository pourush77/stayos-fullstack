# StayOS Test Credentials

All demo users share the password **`Password123!`**.

| Role | Email | Users perms |
|---|---|---|
| Owner | `owner@stayos.local` | Full access (can assign OWNER) |
| Admin | `admin@stayos.local` | Full access (cannot assign OWNER) |
| Manager | `manager@stayos.local` | View users, view billing |
| Manager | `gaurav.gaur@stayos.local` | Same as above |
| Front Desk | `frontdesk@stayos.local` | Check-in / billing (view + manage) |
| Housekeeping | `housekeeping@stayos.local` | Housekeeping app only |
| Maintenance | `maintenance@stayos.local` | Maintenance module |
| Accounts | `accounts@stayos.local` | Full billing (view + manage); reports view |
| Read Only | `readonly@stayos.local` | View-only |

## Property (seeded)
- Name: **The Oberoi Grand** (aka "Hillston Hotel" in code)
- Property ID rotates each time `bootstrap:demo` runs. Get it via:
  `curl -s -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@stayos.local","password":"Password123!"}' | jq -r '.data.user.propertyId'`

## Services (this container, all under supervisor)
- Postgres 15: `localhost:5432`, DB `stayos_dev`, user `stayos`, pass `StayOS@2026`  (supervisor: `postgres`)
- Backend Nest: `localhost:8001` (supervisor: `stayos_api`)
- Frontend Next.js: `localhost:3000` (supervisor: `frontend`)

## URLs
- Frontend: `https://pms-integration-fix.preview.emergentagent.com`
- API: `https://pms-integration-fix.preview.emergentagent.com/api/v1`

## Recovering after a DB reset
```bash
sudo -u postgres psql -c "CREATE USER stayos WITH PASSWORD 'StayOS@2026' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE stayos_dev OWNER stayos;"
cd /app/stayos-api && npm run migration:run && npm run bootstrap:demo && node scripts/bootstrap-billing.js
sudo supervisorctl restart stayos_api
```

> NOTE: In this environment the StayOS API runs on port 3001 (http://localhost:3001/api/v1), not 8001.

## F1 session (2026-08-17)
- Postgres reused from `/app/postgres_data` on `localhost:5432` (recreate ephemeral dirs after pod resume: `pg_notify pg_stat_tmp pg_serial pg_snapshots pg_logical/snapshots pg_logical/mappings` then start with `sudo -u postgres /usr/lib/postgresql/15/bin/pg_ctl -D /app/postgres_data start`).
- Nest API (this session) runs on **:3002** → `http://localhost:3002/api/v1` (`stayos-api/.env` PORT=3002). Login: `admin@stayos.local` / `Password123!` (token at `data.accessToken`).
- Property Hillston Resort (HILLSTON_IND) id: `9d0680c0-89b0-41d5-ae06-b08cd7bedeae`.
- QA baseline config seeded via `cd /app/stayos-api && npx ts-node -r tsconfig-paths/register -r dotenv/config scripts/seed-qa-config.ts` (idempotent).

## F3 session (2026-08-17) — UI browser-reachable setup
- Nest API now on **:8001** (ingress `/api` → 8001); preview `https://0c9a02a5-a776-4fec-8e1d-b4f6511c9382.preview.emergentagent.com/api/v1/health` works.
- Frontend served via `next dev` on :3000 (supervisor frontend stopped). `apps/web/.env.local` sets NEXT_PUBLIC_API_PUBLIC_BASE_URL to the preview `/api/v1`.
- Start API: `cd /app/stayos-api && PORT=8001 npx nest start`. Start web: `cd /app/apps/web && PORT=3000 npx next dev`.
- F3 test reservations (guest Karan Gill, DLX 2026-11-10→12): PENDING `HS260817-01000`, CONFIRMED `HS260817-01001`.
