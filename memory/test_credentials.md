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
- Frontend: `https://74a8720a-4322-499a-bf79-47af279c926d.preview.emergentagent.com`
- API: `https://74a8720a-4322-499a-bf79-47af279c926d.preview.emergentagent.com/api/v1`

## Recovering after a DB reset
```bash
sudo -u postgres psql -c "CREATE USER stayos WITH PASSWORD 'StayOS@2026' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE stayos_dev OWNER stayos;"
cd /app/stayos-api && npm run migration:run && npm run bootstrap:demo && node scripts/bootstrap-billing.js
sudo supervisorctl restart stayos_api
```
