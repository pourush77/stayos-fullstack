# StayOS Demo Setup

## Prerequisites

- Node.js dependencies installed with `npm install`.
- Docker Desktop or Docker Compose available.
- Local environment variables match `.env.example`, or defaults are acceptable:
  - `DATABASE_HOST=localhost`
  - `DATABASE_PORT=5432`
  - `DATABASE_NAME=stayos_dev`
  - `DATABASE_USERNAME=stayos`
  - `DATABASE_PASSWORD=StayOS@2026`

## Commands

```bash
docker compose up -d
npm run migration:run
npm run bootstrap:demo
npm run start:dev
```

`npm run bootstrap:demo` is the only demo data command testers need. It runs the internal bootstrap files in `scripts/bootstrap` in dependency order.

## Login Credentials

All demo users use `Password123!`.

- `manager@stayos.local`
- `gaurav.gaur@stayos.local`
- `frontdesk@stayos.local`
- `housekeeping@stayos.local`
- `maintenance@stayos.local`
- `accounts@stayos.local`
- `owner@stayos.local`
- `admin@stayos.local`
- `readonly@stayos.local`

## Demo Data Included

- Hillston Hotel property using code `HILLSTON_IND`.
- Second Floor and Third Floor only.
- Deluxe and Suite room types.
- 24 rooms: 201-212 and 301-312.
- 9 auth users including Gaurav Gaur.
- 11 operational employees across housekeeping, maintenance, front desk, and accounts.
- 36 realistic guests.
- 46 reservation scenarios covering arrivals, active stays, departures, payment states, OTA, direct, corporate, walk-in, no-show, and cancelled bookings.
- Housekeeping scenarios for unassigned dirty rooms, assigned rooms, started cleaning, inspection, rework, maintenance, and out-of-service.
- Activity feed entries created through the existing `activity_events` table.

## Troubleshooting

- If the script cannot connect to Postgres, confirm `docker compose up -d` completed and the `.env` database settings match Docker Compose.
- If enum errors appear, run `npm run migration:run` before the bootstrap.
- The script is idempotent. Re-run `npm run bootstrap:demo` after code or database resets; it updates existing demo rows instead of duplicating them.
- Reservation codes are generated internally for seed records because the database requires a code. Application APIs still own reservation code generation for normal frontend-created bookings.
