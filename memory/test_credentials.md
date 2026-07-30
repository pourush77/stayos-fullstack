# StayOS Test Credentials

All demo users share the password **`Password123!`**.

| Role | Email | Notes |
|---|---|---|
| Owner | `owner@stayos.local` | Full access; can assign OWNER role |
| Admin | `admin@stayos.local` | Full access except assigning OWNER role |
| Manager | `manager@stayos.local` | Ops manager (view most modules) |
| Manager | `gaurav.gaur@stayos.local` | Additional demo manager |
| Front Desk | `frontdesk@stayos.local` | Check-in / booking access |
| Housekeeping | `housekeeping@stayos.local` | Housekeeping-only staff app |
| Maintenance | `maintenance@stayos.local` | Maintenance module |
| Accounts | `accounts@stayos.local` | Billing/reports role |
| Read Only | `readonly@stayos.local` | View-only |

## Property (seeded)
- Property Name: **The Oberoi Grand** (aka Hillston Hotel in code)
- Property ID: `58e09f5d-b0d9-4af1-b3cf-a8ae38043210`

## Database (local dev)
- Postgres: `localhost:5432`
- DB: `stayos_dev`
- User: `stayos`
- Password: `StayOS@2026`

## URLs (this container)
- Frontend: `https://74a8720a-4322-499a-bf79-47af279c926d.preview.emergentagent.com`
- API Base: `https://74a8720a-4322-499a-bf79-47af279c926d.preview.emergentagent.com/api/v1`
- Backend internal: `http://localhost:8001/api/v1` (routed to preview URL under `/api/*`)
