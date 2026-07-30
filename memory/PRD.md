# StayOS — PRD & Progress Ledger

## Original Problem Statement
User owns two GitHub repos:
- Frontend: `pourush77/stayos-web` — Next.js 15 monorepo (npm workspaces: `apps/web`, `packages/ui|theme|types|utils|config`)
- Backend: `pourush77/stayos-api` — NestJS + TypeORM + PostgreSQL

Handoff summary identified many pending pieces on both sides. User goal: complete pending pages & functionality, module by module, across both repos, without pushing to their GitHub accounts (they will use "Save to GitHub" themselves when ready).

## Environment (this container)
- Backend: NestJS running on `localhost:8001` (mapped via k8s ingress to `/api/*` on preview URL)
- Frontend: Next.js dev on `localhost:3000` (supervisor-managed via `/app/frontend` → symlink → `/app/apps/web`)
- Postgres 15 running locally with DB `stayos_dev`, user `stayos`, password `StayOS@2026`
- Backend `.env` sets `PORT=8001`, `SESSION_IDLE_LOCK_MINUTES=1440` (24 h — long shifts), `CORS_ORIGINS` includes preview URL
- Frontend `.env.local` sets `NEXT_PUBLIC_API_BASE_URL=<preview-url>/api/v1`
- `next.config.ts` `allowedDevOrigins` extended to include `*.preview.emergentagent.com` / `*.preview.emergentcf.cloud`

## User Personas
1. **Owner** — Full authority incl. assigning OWNER role
2. **Admin** — Full ops incl. user management (excluding OWNER role assignment)
3. **Manager** — Ops oversight (bookings, rooms, guests, employees view)
4. **Front Desk** — Bookings, check-in, rooms, guests, housekeeping visibility
5. **Housekeeping** — Task-only staff app
6. **Maintenance** — Ticket-based module (mostly pending)
7. **Accounts** — Billing / reports (pending pages)
8. **Read-only** — Dashboard-only

## Sessions Ledger

### Session 1 — 2026-07-30 — Bootstrap + Auth Module Complete
- Set up dev environment: cloned `stayos-api`, installed Node 22 + Postgres 15, ran TypeORM migrations, seeded demo data via `npm run bootstrap:demo`, built & started Nest API on port 8001.
- Fixed bootstrap bug in `scripts/bootstrap/03-employees.js` (added explicit `::employees_department_enum` and `::text` casts to eliminate ambiguous `$6` param typing).
- Added dynamic CORS in `main.ts` reading `CORS_ORIGINS` env var.
- Wired frontend `.env.local` to hit the preview API URL. Extended `next.config.ts` `allowedDevOrigins` so Next.js dev doesn't block hydration on the preview domain.
- Made supervisor's `/app/frontend` point (via symlink) to `/app/apps/web`; updated `apps/web/package.json` `start` script to `next dev --port 3000 -H 0.0.0.0`.
- Delivered **Codebase Audit** feature-by-feature: Auth, Booking, Check-in, Rooms, Guests, Housekeeping, Employees, Missing pages, Backend gaps.

#### Auth module — DONE
- **User Management UI** (new) — `/settings/users` — full CRUD + admin-triggered password reset + activate/deactivate. Gated by `users.view` / `users.manage` permissions (Owner + Admin only).
- **Settings landing page** (new) — `/settings` — tile-based overview with role-gated visibility. Shows Users + Employees active, plus 4 placeholder tiles (Property, Security & Sessions, Preferences, API Keys).
- **"Forgot Password?" link** rewritten to show a friendly "Contact your administrator to reset your password" message rather than "Coming Soon". Passwords are set hierarchically via the User Management page.
- **Session idle-lock** bumped to 24 h backend-side (`SESSION_IDLE_LOCK_MINUTES=1440`) so long receptionist shifts are never interrupted. Client-side idle detector intentionally not built per user request.
- Verified end-to-end via curl: create → update role → reset password → login with new password → deactivate → login blocked.
- Verified UI: Users list loads real data with role/status badges & last-login timestamps; Add User modal renders correctly; self-deactivation button is disabled; Reset Password modal enforces min-8 chars & confirmation.

#### Files added / changed in Session 1
Backend (`/app/stayos-api`):
- `src/main.ts` — dynamic CORS
- `scripts/bootstrap/03-employees.js` — enum cast fix
- `.env` — new keys: `PORT=8001`, `CORS_ORIGINS`, `SESSION_IDLE_LOCK_MINUTES=1440`
- (WIP, uncompiled) `src/core/billing/**` — folio module scaffolding started (entities, DTOs, migration, service, mapper). Not registered in AppModule yet.

Frontend (`/app`):
- `apps/web/next.config.ts` — allowedDevOrigins
- `apps/web/package.json` — start script
- `apps/web/.env.local` — API base URL
- `apps/web/src/features/users/types/user.types.ts`
- `apps/web/src/features/users/api/users-api.ts`
- `apps/web/src/features/users/components/UsersPage.tsx`
- `apps/web/src/app/settings/page.tsx`
- `apps/web/src/app/settings/users/page.tsx`
- `apps/web/src/app/login/page.tsx` — "Forgot Password?" hint text updated

## Prioritized Backlog

### P0 — next up
- **Billing / folios module** (backend + frontend) — folio auto-created on booking; charges list; payments; settle folio; wire into Stay Workspace billing panel & "Collect Payment" button.
- **Extend stay** endpoint & modal Save wiring.
- **Mobile check-in capture** backend controller (frontend already calls `/check-in-capture/:token`, `/mobile-capture`, `/mobile-capture/status`, `/mobile-capture/:sessionId/documents` — these must be built).
- **Actual document upload** in `CheckInModal` (currently both buttons are `disabled`).

### P1
- Requests module (backend entity + endpoints; wire `/requests` page — currently uses hardcoded const).
- Room move during stay (backend endpoint + wire from Stay Workspace).
- Reports page + backend aggregation endpoint.
- Marketplace page (placeholder polish).
- Guest documents upload from Guest Profile page.
- Availability calendar view.

### P2
- Maintenance module UI + admin view of tickets.
- Domain event emission (audit trail).
- Amenities module (schema + APIs).
- Frontend tests.
- Fill in placeholder docs (`docs/01_Product_Vision.md`, `02_PRD.md`, `03_Software_Architecture.md`, `05_Development_Roadmap.md`).
- Update README with correct run commands.

## Notes for future contributors
- The `.env` files in both repos are populated for LOCAL DEV in this container. For the user's local machine, `NEXT_PUBLIC_API_BASE_URL` should be their LAN IP: `http://192.168.1.31:3002/api/v1`, and backend's `PORT=3002`.
- Backend expects `sudo -u postgres` service running. In production this points to the real Postgres cluster.
- `AUTH_ENABLED=true` — permission guard active.
- The Prisma schema in `/app/prisma` is stub-only; the backend owns the DB via TypeORM. Consider removing it in a future cleanup pass.
