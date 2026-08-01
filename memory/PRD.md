# StayOS — PRD & Progress Ledger

## Original Problem Statement
User owns two GitHub repos:
- Frontend: `pourush77/stayos-web` — Next.js 15 monorepo (npm workspaces: `apps/web`, `packages/ui|theme|types|utils|config`)
- Backend: `pourush77/stayos-api` — NestJS + TypeORM + PostgreSQL

User asked us to complete pending pages & functionality, module by module, across both repos, WITHOUT pushing to their GitHub accounts (they use "Save to GitHub" themselves when ready).

## Environment (this container)
- **Postgres 15** — supervisor `postgres`, DB `stayos_dev`, user `stayos`
- **Backend NestJS** — supervisor `stayos_api`, port `8001`, mapped to `/api/*` on preview URL via k8s ingress
- **Frontend Next.js dev** — supervisor `frontend`, port `3000`, `/app/frontend` → symlink → `/app/apps/web`
- All 3 services now auto-restart via supervisor (`/etc/supervisor/conf.d/stayos.conf`).
- Backend `.env`: `PORT=8001`, `SESSION_IDLE_LOCK_MINUTES=1440`, `CORS_ORIGINS` includes preview URL.
- Frontend `.env.local`: `NEXT_PUBLIC_API_BASE_URL=<preview-url>/api/v1`.
- `next.config.ts` `allowedDevOrigins` extended for `*.preview.emergentagent.com` / `*.preview.emergentcf.cloud`.

## User Personas
1. **Owner** — Full authority incl. assigning OWNER role.
2. **Admin** — Full ops incl. user management (cannot assign OWNER).
3. **Manager** — Ops oversight.
4. **Front Desk** — Bookings, check-in, rooms, guests, housekeeping visibility, **billing (view + manage)** — collects payments at reception.
5. **Housekeeping** — Task-only.
6. **Maintenance** — Ticket-based.
7. **Accounts** — **Full billing + reports**.
8. **Read-only** — Dashboard-only.

## Sessions Ledger

### Session 1 — 2026-07-30 — Bootstrap + Auth + Billing
**Environment**
- Cloned `stayos-api`; installed Node 22, Postgres 15; ran TypeORM migrations; seeded demo data.
- Registered Postgres + Nest under supervisor so they auto-restart if the container recycles them.
- Fixed enum-typing bug in `scripts/bootstrap/03-employees.js`.
- Added dynamic CORS to Nest via `CORS_ORIGINS` env var.
- Fixed Next.js hydration blockage by extending `allowedDevOrigins`.

**Auth section — DONE**
- User Management UI (`/settings/users`): full CRUD + admin password reset + activate/deactivate.
- Settings landing page (`/settings`) with 6 tiles (Users + Employees active; 4 placeholders).
- Forgot Password → "Contact your administrator" hint (no self-serve; passwords set hierarchically).
- Session idle lock bumped to 24 h backend side; no client-side lock modal per user request.

**Billing section — DONE**
- **Backend** (NestJS):
  - New module `src/core/billing/` with 3 entities: `FolioEntity`, `FolioChargeEntity`, `FolioPaymentEntity`.
  - Migration `1783924200000-CreateBillingTables.ts` creates 3 enums + 3 tables + FKs + indexes.
  - `BillingService` handles: list folios, get folio, get/create folio for reservation (auto-computes ROOM charges & tax on first open), add charge, add payment (auto-updates reservation `paymentStatus`), settle folio (only when balance ≤ 0), overview aggregation.
  - `BillingController` endpoints (permission-gated by `billing.view` / `billing.manage`):
    - `GET /properties/:pid/folios[?status=OPEN|SETTLED|VOID]`
    - `GET /properties/:pid/folios/:folioId`
    - `GET /properties/:pid/reservations/:reservationId/folio` (get-or-create)
    - `GET /properties/:pid/billing/overview` (KPIs)
    - `POST /properties/:pid/folios/:folioId/charges`
    - `POST /properties/:pid/folios/:folioId/payments`
    - `POST /properties/:pid/folios/:folioId/settle`
  - Registered in `AppModule`. `FRONT_DESK` role granted `BillingManage` so reception can collect payment.
  - Idempotent seed script: `scripts/bootstrap-billing.js`.
- **Frontend** (Next.js):
  - `/billing` — full folios list, 5 KPI stat cards (open, settled, outstanding, today revenue, this month), search + status filter, per-row "Open" link.
  - `/billing/[folioId]` — folio detail with charges & payments tables, action buttons (Add Charge, Collect Payment, Settle Folio), color-coded charge type badges, VIP badge on guest, Back to Billing breadcrumb.
  - Reusable `FolioPanel` component (`features/billing/components/FolioPanel.tsx`) drives both the folio detail page and the Stay Workspace billing accordion.
  - **Stay Workspace billing panel** replaced the "coming soon" stub with a real embedded folio panel and enabled the Collect Payment button (was hardcoded `disabled`).
  - Two modals: **Add Charge** (type/description/qty/unit/tax) and **Collect Payment** (method/amount/reference/notes) with live balance-due display + validation.
  - Currency formatted as `en-IN` INR everywhere.

**Verified end-to-end via curl + browser:**
Create folio → add F&B & minibar charges → record card payment → reservation `paymentStatus` auto-updates → list folios shows correct paid/balance → overview aggregates outstanding & revenue → `/billing` UI shows 4 folios with the seeded data & correct badge colours.

**Files added / changed in Session 1**

Backend (`/app/stayos-api`):
- `src/main.ts` — dynamic CORS.
- `src/app.module.ts` — registered `BillingModule`.
- `src/core/auth/role-permissions.ts` — FRONT_DESK gets `BillingManage`.
- `src/core/billing/**` — full module (entities, DTOs, service, mapper, controller, module).
- `src/database/migrations/1783924200000-CreateBillingTables.ts`.
- `scripts/bootstrap/03-employees.js` — enum cast fix.
- `scripts/bootstrap-billing.js` — new idempotent billing seed.
- `.env` — added `PORT=8001`, `CORS_ORIGINS`, `SESSION_IDLE_LOCK_MINUTES=1440`.

Frontend (`/app`):
- `apps/web/next.config.ts` — `allowedDevOrigins` for preview domains.
- `apps/web/package.json` — start script bound to port 3000.
- `apps/web/.env.local` — API base URL.
- `apps/web/src/features/users/**` — new (types, api, `UsersPage.tsx`).
- `apps/web/src/features/billing/**` — new (types, api, `FolioPanel.tsx`, `BillingPage.tsx`).
- `apps/web/src/features/stays/components/StayBillingPanel.tsx` — new.
- `apps/web/src/features/stays/components/StayWorkspace.tsx` — wired billing panel + auth-context.
- `apps/web/src/app/settings/page.tsx` — settings landing.
- `apps/web/src/app/settings/users/page.tsx` — Users route.
- `apps/web/src/app/billing/page.tsx` — Billing list route.
- `apps/web/src/app/billing/[folioId]/page.tsx` — Folio detail route.
- `apps/web/src/app/login/page.tsx` — "Forgot Password?" hint text.

Container:
- `/etc/supervisor/conf.d/stayos.conf` — auto-managed `postgres` + `stayos_api` services.

## Prioritized Backlog

### V1 — LAUNCH READY (2026-08-01) ✅
Full front-desk lifecycle certified for real staff use. See CHANGELOG.md 2026-08-01 entry.

### P1 — post-launch enhancements
- Guest Signature Capture (signature pad → save as GUEST_SIGNATURE doc).
- Persist Face Snap (webcam capture from Check-In → save as GUEST_FACE doc for audit).
- OCR Confidence indicators (🟢🟡🔴 next to auto-filled ID/Name/DOB fields).
- Housekeeping Inspect modal: pre-load the housekeeper's submitted checklist (currently starts empty).
- Housekeeping: surface API error toasts on failed mutations.
- Availability Calendar: empty-cell click opens New Booking prefilled.
- Availability Calendar: populate `roomTypeName` in payload (currently '—').
- Housekeeping board: refactor to smaller components + add data-testid coverage.
- Housekeeping staff access token endpoint should return 401/404 instead of 400.

### P2
- Maintenance module UI + tickets (backend module scaffolded, no UI).
- Amenities module (schema + APIs + denormalize into room types).
- Additional Guests table & unhidden UI.
- Audit trail viewer UI.
- Property / Preferences / Security / API Keys settings tiles.
- Rate/pricing engine (replace hardcoded default rates for accurate revenue reporting).
- Frontend tests setup (Vitest + MSW).
- Repo-wide lint cleanup (500+ errors in scripts/ + type imports).
- CheckIn workspace: native DoB input → Mantine DateInput.
- `/reports` duplicate React key warning.
- `/reports` "Expected today" copy for future arrivals.
- List envelope inconsistency (bare array vs `{items,...}`).
- Add proper data-testid attributes to /housekeeping board + Availability Calendar cells.

## Notes for future contributors
- For the user's local machine, `NEXT_PUBLIC_API_BASE_URL` should be their LAN IP (`http://192.168.1.31:3002/api/v1`) and backend's `PORT=3002` — different from this container's setup which uses `8001` to piggyback on the preview ingress `/api/*` route.
- `AUTH_ENABLED=true` — permission guard active.
- Folio numbers follow the pattern `FOYYMMDD-00001` scoped per property.
- Balance-based reservation `paymentStatus` sync happens inside `BillingService.addPayment` — no separate call needed from the frontend.
- The backend is compiled (dist/) and runs via `node dist/src/main.js`. Any TS change to `stayos-api/` requires `npm run build` + `sudo supervisorctl restart stayos_api`.
- `packages/ui/src/layout/stayos-app-shell.tsx` — must reference `process.env.NEXT_PUBLIC_API_BASE_URL` directly (Next.js only inlines literal references). Do NOT indirect via `globalThis`.
