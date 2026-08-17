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

### 2026-08-03 — Walk-in Group + Phase 5B room-card group context
- **Container restore**: reinstalled Postgres 15, dependencies, ran migrations + demo bootstrap, wired supervisor `backend` → NestJS, `frontend` → Next.js, `postgres` → pg_ctlcluster. Both services healthy.
- **Walk-in Group one-click flow (NEW)** — chat #7 spec, single-transaction endpoint:
  - `POST /properties/:propertyId/operations/group-holds/walk-in` (controller + service `createWalkInGroup`).
  - In one DB transaction: creates `group_bookings` (status `CHECKED_IN`, source `WALK_IN`), room-type inventory blocks, physical room assignments, `group_stays`, single `group_master_folios`, marks all selected rooms `OCCUPIED`.
  - Validates: property, date range, ready-status of every room, no reservation conflicts, no active-group assignment conflicts.
  - Groups per-room adults/children into per-type blocks automatically.
  - Frontend: `WalkInGroupModal.tsx` (Bookings page → "Walk-in Group" button). Live room availability by type, per-room occupant name/adults/children, deposit, notes. Success state shows GRP code + folio number + occupied rooms + link to master folio. On success refreshes in-house groups list on Bookings page.
- **Phase 5B — Room card group context**:
  - `RoomCard` on `/rooms` now shows green `GROUP · GRP-XXXXX` badge when the room's `groupContext` is populated.
  - `getRoomSubtitle` renders `${groupCode} · ${groupName}` for group-occupied rooms (previously just guest name).
  - Backend already provided `groupContext` on both room-board list & room-drawer detail.
- **Verified end-to-end**: created walk-in group `GRP-00002` via UI (rooms 301, 302), master folio `GFO-00002` opened, room cards show `GROUP · GRP-XXXXX` badges. Existing group `GRP-00001` (created via API) also visible on both Bookings in-house list and Rooms board.
- **Tests**: `npm test` in stayos-api → 38 suites / 252 tests all passing. `npm run build` passes. `tsc --noEmit` passes. ESLint clean on both modified files.


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

## 2026-08-16 — Property Settings: Group Booking Deposit
- Root cause: reported 400 "should not exist" came from a STALE API build (old UpdatePropertyDto without deposit fields); current source validates correctly. Real source defect: deposit fields missing @ApiPropertyOptional so absent from Swagger PATCH schema.
- Fix: added @ApiPropertyOptional to groupBookingDepositPolicyType/Value in update-property.dto.ts; requires nest build + API restart to clear stale build.
- Tests: stayos-api properties (22) + group-booking-deposit-policy (9) green; nest build passes.

## 2026-08-16 — group-room-mix-suggestions NONE+0 fix
- Root cause: normalizeGroupBookingDepositPolicy() rejected any non-null value for NONE, so persisted DB default (NONE, value 0) passed by group-room-mix.service caused 400.
- Fix (normalization only): NONE now accepts undefined/null/0 (normalize to 0), rejects >0; PERCENTAGE >0..100; FIXED_AMOUNT >0.
- Verified via testing_agent (iteration_4): real endpoint returns 200; 100% backend pass. No schema change/migration.

## 2026-08-16 — Phase-1 Property/Policy Foundation
- Added property_policies (deposit/cancellation/no-show/early-checkin/late-checkout; separable structured columns; rate_plan_id nullable + partial-unique for future hierarchy), property_billing_configs (invoice prefix/numbering + HSN/SAC), properties.business_day_cut_off_time + BusinessDateService, reservations.policy_snapshot/tax_snapshot (nullable foundation).
- Endpoints: GET/PUT /properties/:id/policies(/:policyType), GET/PUT /properties/:id/billing-config. Deposit reuses normalizeGroupBookingDepositPolicy.
- 4 migrations (20260817090000-093000) applied. Verified via testing_agent iteration_5 (36/36 after fixing foreign-ratePlanId 500->404). Jest: 18 policies + related green.
- Next-phase blockers: consolidate legacy properties.group_booking_deposit_* into property_policies (currently dual source); populate reservation snapshots at booking; rate-plan override read path + seeding.

## 2026-08-16 — Phase-1A: property_policies as authoritative deposit source
- Deposit calc (group-room-mix, group-booking) + property GET/PATCH facade now resolve from property_policies via PolicyResolverService (RatePlan override -> Property default). Generic normalizeDepositPolicy replaces group-specific one.
- Migration 20260818090000 backfilled GROUP_DEPOSIT rows and DROPPED legacy properties.group_booking_deposit_policy_* columns (single source of truth).
- Verified: testing_agent iteration_6 100% (18 new + 41 regression), + resolver/negative-NONE/rate-plan-scoped-GET fixes (59 pytest + 48 jest green).
- Phase-1B blockers: booking-time reservation policy/tax snapshot population; RatePlan CRUD to exercise overrides; wrap property base-save + deposit upsert in one transaction; consolidate DTO deposit rules into shared normalizer; batch-load deposits in properties list (N+1) when multi-property lands.

## 2026-08-16 — Phase-1A consistency: atomic Property PATCH + DTO shape-only
- Property PATCH now wraps GROUP_DEPOSIT policy upsert + base save in ONE transaction (deposit-first); invalid deposit or either save failing rolls back everything.
- Removed duplicated deposit business rules from UpdatePropertyDto (shape/type only); shared normalizer via PoliciesService.upsert is the single rule source.
- Verified: testing_agent iteration_7 100% (atomic rollback via API confirmed) + 139 jest green.
- Next: Phase 1B Reservation & Stay Lifecycle (Rate Plan CRUD deferred to 1C).

## 2026-08-16 — Phase-1B Reservation & Stay Lifecycle
- Added canonical transition map (reservation-transitions.ts) as single source of truth + confirm/cancel/markNoShow in reservation-workflow.service (assign/move/check-in/out/extend pre-existing).
- Confirm freezes immutable policy_snapshot+tax_snapshot (PolicyResolverService + TaxService). Cancel/no-show release the room-night hold (roomId cleared).
- Closed HIGH bypass: status removed from UpdateReservationDto (OmitType) -> transitions only via lifecycle endpoints. Fixed MEDIUM: generic PATCH FK/relation updates now reliable + response re-fetched.
- Verified testing_agent iteration_9 100% (42/42); jest reservations 74 green.
- Phase-1C blockers: source enum expansion (PHONE/CHANNEL/OTHER) + external reservation/confirmation IDs foundation NOT yet added; expose snapshots via API read model; Inventory + Rate Plans (availability/overbooking/ARI) own the override read path.

## 2026-08-16 — Reservation->Inventory boundary hardening
- Decision: PENDING = canonical HOLD (no separate HOLD). Inventory entitlement = property+roomType+dates+status (INVENTORY_CONSUMING_STATUSES=PENDING/CONFIRMED/CHECKED_IN); roomId is assignment-only.
- Removed the wrong "clear roomId releases inventory" assumption; cancel/no-show now release via releaseInventoryEntitlement() hook (RESERVATION_INVENTORY_RELEASED audit event, terminal-status driven) and KEEP roomId. Assign/unassign never triggers release.
- Verified testing_agent iteration_10 100% (53/53); jest reservations 78 green.
- Phase-1C blockers: implement the actual availability ledger inside the releaseInventoryEntitlement hook + reserve-on-confirm; room-type/date availability + overbooking + daily rates + rate plans + restrictions as single source; source/external-ID + snapshot read-model can fold into 1C.

## 2026-08-16 — Phase 1C-a1: Room-Type Inventory Foundation (standalone, NOT wired)
- New `room_type_inventory` entity/table: unique (property_id, room_type_id, date); DB invariants capacity>=0, sold>=0, sold<=capacity; FKs to properties/room_types (RESTRICT). Files: `core/inventory/infrastructure/room-type-inventory.entity.ts`.
- Semantics locked: capacity = STRUCTURAL room-type inventory (count of `rooms.status='ACTIVE'` for property+roomType; NOT reduced by DIRTY/MAINTENANCE/occupied/assigned — those are future OOO layers). sold = inventory CONSUMED (entitlement), not confirmed sales. available = capacity - sold. Physical roomId assignment never affects sold.
- Migration `20260819090000-CreateRoomTypeInventory.ts`: creates table + indexes + FKs, then deterministic backfill = one row per stay-night of every currently consuming reservation (PENDING/CONFIRMED/CHECKED_IN), capacity from active room count. Backfill NEVER clamps/inflates/silently-corrects: nights where sold>capacity are RAISE WARNING-reported and intentionally left un-backfilled for reconciliation to surface.
- `AvailabilityService` (`core/inventory/availability.service.ts`): read([start,end)), reserve(), restore(). Deterministic ascending-by-date `SELECT ... FOR UPDATE` locking. Concurrency-safe lazy row creation via `INSERT ... ON CONFLICT DO NOTHING` + re-SELECT FOR UPDATE (unique index is final safeguard; no duplicate-key surfaced). reserve throws ConflictException(INVENTORY_UNAVAILABLE) when available<units (no oversell); restore clamps at 0.
- `InventoryReconciliationService` (`core/inventory/inventory-reconciliation.service.ts`): read-only; recomputes expected sold/capacity from reservations+active rooms, FULL OUTER JOIN vs stored; classifies MISSING_ROW / ORPHAN_SOLD / SOLD_MISMATCH / CAPACITY_MISMATCH / OVERSELL. Never mutates.
- `InventoryModule` registered in AppModule. Added ApiErrorCode.INVENTORY_UNAVAILABLE. NOT wired into reservation lifecycle (no controller, no endpoint, reservation flows unchanged).
- Verified: nest build clean; `npm test` 501/501 (55 suites) green (incl. 20 new inventory tests: nights domain, availability service in-memory concurrency/last-room/no-partial-oversell/restore, reconciliation classifications). Fixed a pre-existing stale smoke spec (`hotel-inventory-api-smoke.spec.ts` was missing a PolicyResolverService provider added back in Phase 1A). Live DB check: migration backfilled 90 rows / 0 invariant violations; reconcile() surfaced the 4 demo oversold nights as OVERSELL+MISSING_ROW; AvailabilityService.read reports full structural capacity for future no-row dates. App boots cleanly (InventoryModule dependencies initialized).
- Phase-1C-a2 (next): transactional inventory consumption wiring (reserve-on-confirm) — still to be done in a later slice.

## 2026-08-16 — Phase 1C-a2: Entitlement-driven inventory consumption (creation + consuming-entry)
- Design correction adopted: inventory changes ONLY when the reservation entitlement crosses the consuming/non-consuming boundary — NOT "reserve on confirm". Shared pure helper `core/reservations/domain/reservation-inventory-transition.ts`: `inventoryDeltaForTransition(from|null, to)` -> RESERVE (enter consuming) / RELEASE (leave consuming, 1C-a3) / NONE (consuming->consuming or non->non).
- Integration point: `ReservationsService.create()` is now transactional (`dataSource.transaction`). Reservation row is saved and, iff `inventoryDeltaForTransition(null, status) === RESERVE`, `AvailabilityService.reserve({propertyId, roomTypeId, nights=expandStayNights(arrival,departure), units:1}, manager)` runs in the SAME transaction. Any night out of stock throws ConflictException(INVENTORY_UNAVAILABLE) -> whole tx rolls back (no reservation, no partial inventory). `ReservationsModule` now imports `InventoryModule`.
- confirm()/checkIn() DELIBERATELY untouched: PENDING->CONFIRMED and CONFIRMED->CHECKED_IN are consuming->consuming (delta NONE) so they naturally reserve nothing. roomId assign/unassign/move paths contain zero inventory calls by construction — roomId has no inventory effect. cancel/no-show/check-out RELEASE deferred to 1C-a3.
- No double-count: consumption is driven off the transition DELTA (from=null on create), never by replaying existing backfilled entitlements.
- Verified: build clean; full `npm test` 508/508 (56 suites) incl. new transition matrix spec + 3 create-inventory specs (reserve 1/night on consuming create, no reserve into non-consuming status, rollback on insufficient). Live DB e2e (throwaway script, cleaned up): (1) create PENDING -> +1/night; (2) confirm -> unchanged; (3) check-in gate hit but inventory unchanged; (4) insufficient -> INVENTORY_UNAVAILABLE; (5) 2-night booking with one night full -> full rollback, other night unchanged (no partial); (6) assign path has no inventory code; (7) no double count. 0 residue, 0 invariant violations after run.
- Transactional integration points (exact): `ReservationsService.create` (only consuming-entry site in the current state machine). Future non-consuming->consuming transitions must call the same delta helper inside their mutation transaction.
- Phase-1C-a3 (NOT started): RELEASE wiring for cancel/no-show/check-out + date-change/roomType-change entitlement adjustment via the same delta abstraction.

## 2026-08-16 — Phase 1C-a3: Entitlement release + date/roomType diff mutations
- Canonical release path: `ReservationWorkflowService.releaseInventoryEntitlement()` now performs the real `AvailabilityService.restore(...)` (in addition to the RESERVATION_INVENTORY_RELEASED audit event). Wired for cancel + no-show (via `terminate()`) AND check-out (added `getReservationInventoryEntitlement` capture before status flip + `releaseInventoryEntitlement` call). One canonical release path — no second restore mechanism. Double-release impossible: `assertReservationTransition`/`ensureReservationStatus` guards make terminal transitions run once.
- Shared diff abstraction `diffEntitlements(before, after)` in `reservation-inventory-transition.ts`: returns `{toRelease, toReserve}` InventoryKey[] (roomTypeId+date). Only disappearing keys release, only new keys reserve, overlap untouched; a roomType change transfers the whole entitlement (all old release, all new reserve) even on overlapping dates.
- New engine primitive `AvailabilityService.applyDelta({propertyId, toRelease, toReserve, units}, manager)`: locks EVERY affected (roomType,date) key — release + reserve — in ONE deterministic global order (roomType asc, then date asc) BEFORE mutating; validates all reserve keys have capacity; on shortfall throws INVENTORY_UNAVAILABLE so the caller tx rolls back reservation + all inventory (original entitlement intact); only then decrements releases / increments reserves. This global ordering (consistent with reserve()/restore() single-roomType date-asc) prevents cross-roomType deadlock.
- Integration points (exact): `ReservationsService.update()` now transactional — computes `diffEntitlements` (status unchanged, so consuming flag same both sides) and calls `applyDelta` in the same tx as the reservation save (handles date extend/shorten/shift + roomType change via PATCH). `ReservationWorkflowService.extendStay()` computes the added-nights diff and calls `applyDelta`. `moveRoom` untouched (roomId change = zero inventory effect by construction).
- Verified: build clean; full `npm test` 523/523 (56 suites) — added diffEntitlements matrix (extend/shorten/shift/roomType-transfer/non-consuming/unchanged), applyDelta engine tests (atomic transfer + global lock order + rollback-no-partial + date shift), workflow release/reserve assertions (PENDING/CONFIRMED->CANCELLED, CONFIRMED->NO_SHOW, CHECKED_IN->CHECKED_OUT release once; double-release blocked; extend reserves added-only; moveRoom no inventory). Live DB e2e (throwaway, cleaned): 8/8 PASS incl. cancel/no-show release, double-release guard, extend/shorten/shift, roomType transfer, and unavailable-target full rollback (reservation dates + inventory unchanged). 0 residue, 0 invariant violations, app boots.
- Before/after (roomType transfer, rtA->rtB, nights d1,d2): rtA `d1:1 d2:1` + rtB `d1:0 d2:0` → after `rtA d1:0 d2:0` + `rtB d1:1 d2:1`. Unavailable-target extend: night full → whole PATCH rejected, reservation departure + all inventory unchanged.
- Phase-1C-a4 (NOT started): true concurrent last-room oversell tests + full reconciliation/regression gate.

## 2026-08-16 — Phase 1C-a4: Concurrency proof + reconciliation gate + final hardening (1C-a COMPLETE)
- DB-backed concurrency spec `availability.concurrency.spec.ts` (boots real AppModule + Postgres, isolated far-future fixtures, self-cleaning). Proven with REAL simultaneous transactions: (1) two reserves for the last room -> exactly 1 success + 1 INVENTORY_UNAVAILABLE; (2) two multi-night reserves cannot partially consume the overlapping night; (3) lazy row creation under concurrency converges to ONE row, never oversells; (4) concurrent date-extension for the final target night -> exactly one wins; (5) opposite-direction roomType transfers do NOT deadlock (global roomType-asc,date-asc lock order) and conserve counters; (6) reserve/restore batches never duplicate and stay within [0,capacity]; (7) two simultaneous reservation creates never oversell (sold == consuming reservation count); (8) create-vs-cancel race leaves sold == consuming count.
- Reconciliation gate: spec captures global baseline before scenarios, and after full cleanup asserts countsByType returns EXACTLY to baseline -> 1C-a adds zero net drift.
- FINAL HARDENING (fixes the one gap the testing agent flagged): added `reservations.inventory_reserved` boolean (migration `20260820090000`, backfilled true only for consuming reservations FULLY represented in the ledger; oversold/skipped stay false). `releaseInventoryEntitlement` now restores ONLY when `wasReserved` -> release is idempotent/paired; cancelling a never-reserved (legacy/backfill-skipped) reservation can no longer phantom-decrement sold. create() sets the flag on reserve; terminate()/checkOut() capture wasReserved then clear the flag in the same save; update()/extendStay() only mutate inventory when the reservation holds an entitlement.
- Read-only drift health-check endpoint: `GET /api/v1/properties/:propertyId/inventory/reconciliation` (OperationsView; never mutates — proven read-only). ReconciliationResult now includes `countsByType`.
- Results: build clean; full `npm test` 533/533 (57 suites) incl. 9 DB-backed concurrency cases + phantom-release guard test; migration applied (287 consuming reservations flagged reserved, 6 legacy flagged false); 0 invariant violations; testing_agent iteration_11 17/17 externally observable cases PASS (overbooking 409 INVENTORY_UNAVAILABLE, release-on-cancel, last-unit concurrency 1x201+4x409, read-only reconciliation, auth 401). Reconciliation before/after: total drift stays 8 discrepancies, ALL confined to the known demo-oversold dates 2026-11-02/03 (Deluxe+Suite) — zero drift on any other date (composition shifted MISSING_ROW->SOLD_MISMATCH only due to the testing agent's own pytest poking those demo dates, not 1C-a code).
- REMAINING RISK: the ~218 pre-existing demo reservations oversold on 2026-11-02/03 remain (known baseline; NOT a 1C-a defect). Recommend a one-off demo-data cleanup + restoring some rooms to READY (8 legacy lifecycle assignment tests error only because the demo property currently has 0 READY rooms).
- **Phase 1C-a is COMPLETE** (authoritative inventory ledger + transactional consume/release/mutate, concurrency-safe, reconciliation-gated, hardened). Next: Phase 1C-b (Rate Plans) — NOT started. Availability calendar API intentionally NOT exposed yet.

## 2026-08-17 — Demo Data Reset (data/environment cleanup only; NO code/architecture change)
- Root of the known baseline drift: a single stale stress-test batch (reservation_code prefix HS260816, all arrival 2026-11-02 -> departure 2026-11-04, created 2026-08-16) = 436 reservations (224 consuming: 218 Deluxe cap-19 + 6 Suite cap-5, physically impossible; + 212 already terminal). No folios attached.
- Actions (single SQL transaction): deleted the 436 junk reservations + 408 audit_events + 274 activity_events referencing them; deleted 2 test-derived room_type_inventory rows (Deluxe 2026-11-02 & 2026-11-03, sold=0); restored 20 rooms (19 NEEDS_CLEANING + 1 INSPECTION) to READY (cleared reason/note). Left OCCUPIED(2)/MAINTENANCE(1)/OUT_OF_SERVICE(1) as intentional realistic states.
- Environment recovery (container had restarted): brought the standalone Postgres cluster at /app/postgres_data back up — note it is owned by uid 103 (Debian-exim), so start with `sudo -u '#103' /usr/lib/postgresql/15/bin/pg_ctl -D /app/postgres_data -l /tmp/pg103.log -o "-p 5432 -k /tmp" start`; then restart the API via `node dist/src/main.js` on :3001.
- Reconciliation BEFORE: 8 discrepancies {MISSING_ROW:2, SOLD_MISMATCH:2, OVERSELL:4}. AFTER: **0 discrepancies (fully consistent)**, 0 invariant violations. Remaining 69 consuming reservations all inventory_reserved=true and fully ledger-represented; 35 far-future seed reservations are all terminal (31 CANCELLED + 4 NO_SHOW), hold no inventory.
- Verified: build clean; full Jest 533/533 (57 suites); live assign-room lifecycle now works against READY rooms (previously errored on 0 READY rooms). NO 1C-a inventory architecture, entitlement rules, locking, lifecycle logic, migrations, or production code changed.

## 2026-08-17 — Phase 1C-b1: Rate Plan model completion + CRUD (pricing only; inventory untouched)
- Reused existing infra (NOT duplicated): `rate_plans`, `room_type_daily_rates` (date-wise overrides), `guest_pricing_policies`/`child_age_bands`+`ChildPricingService` (extra-child), `property_policies.rate_plan_id`+`PolicyResolverService` (policy overrides), money = numeric(12,2) decimal STRING.
- Migration `20260821090000`: added `rate_plans.meal_plan` (enum ROOM_ONLY/BREAKFAST/HALF_BOARD/FULL_BOARD, default ROOM_ONLY) + `rate_plans.refundable` boolean default true; new `rate_plan_room_types` table (unique (rate_plan_id, room_type_id); FKs property RESTRICT / rate_plan CASCADE / room_type RESTRICT; base_occupancy>=1, base_rate>=0, extra_adult_charge>=0, extra_child_charge>=0) = applicable room types + base commercial terms per room type.
- New entity `RatePlanRoomTypeEntity`; `MealPlan` enum; extended `RatePlanEntity` (mealPlan, refundable). Service methods added: `updateRatePlan`, `findRatePlanRoomTypes`, `upsertRatePlanRoomType`, `removeRatePlanRoomType`, `findDailyRates`, `removeDailyRate` (existing createRatePlan/findRatePlans/findRatePlan/createDailyRate reused).
- HTTP CRUD wired on `RatesController` under `/api/v1/properties/:propertyId/rates`: rate-plans (GET list / POST / GET / PATCH), rate-plans/:id/room-types (GET / PUT upsert / DELETE :roomTypeId), rate-plans/:id/daily-rates (GET / POST), daily-rates/:id (DELETE). Permissions: SettingsView/BookingsView to read, SettingsManage to write. DTOs with money-string + occupancy(int>=1) + enum validation.
- Verified: build clean; rates suite 78/78; full Jest 538/538 (57 suites); live CRUD smoke (create plan w/ mealPlan+refundable, upsert base pricing incl. extra charges, daily override, list, invalid baseRate -> 400, deactivate -> INACTIVE); inventory reconciliation still consistent + 0 invariant violations (zero inventory code touched).
- NOT started: 1C-b2 (RateResolverService) and 1C-b3 (reservation ratePlan link + commercial snapshot). Stopped for verification as instructed.

## 2026-08-17 — Phase 1C-b2: RateResolverService (centralized, deterministic, read-only)
- Schema confirmations: `room_type_daily_rates` is uniquely scoped by (roomTypeId, ratePlanId, stayDate) with a rate_plan_id FK — overrides are already per-rate-plan (isolated across plans); no correction needed. `rate_plan_room_types.base_occupancy` is integer with CHECK>=1 + @IsInt()@Min(1) (whole-number, not monetary); money stays numeric(12,2) decimal strings.
- New `RateResolverService` (`core/rates/rate-resolver.service.ts`), registered + exported in RatesModule (added PoliciesModule import). READ-ONLY: no writes to reservations/inventory/rooms/folios/taxes/invoices/payments.
- Resolution precedence per stay night (independent per night): (1) validate rate plan exists+ACTIVE for property; (2) validate roomType applicability via rate_plan_room_types (carries base rate); (3) per night: DAILY_OVERRIDE (room_type_daily_rates for property+ratePlan+roomType+date) > BASE_RATE (applicability.baseRate); (4) extra-adult = max(0, adults-baseOccupancy) * extraAdultCharge per night; (5) child charges delegated to existing ChildPricingService per night (nights=1, that night's room rate) — no duplication of age-band logic; (6) effective policies via existing PolicyResolverService (RATE_PLAN override > PROPERTY) for CANCELLATION/NO_SHOW/INDIVIDUAL_DEPOSIT/GROUP_DEPOSIT/EARLY_CHECK_IN/LATE_CHECKOUT; (7) returns mealPlan/refundable + per-night breakdown.
- Decimal-safe: all arithmetic in integer cents; rounding (Math.round, half-up) applied only at the per-line monetary boundary; grand total = sum of cents (no re-round drift). Explicit failure (NotFound/BadRequest) when no valid price resolves — never substitutes 0.
- Verified: build clean; focused rates+policies suites 115/115 (8 suites) incl. 14 new resolver tests (override precedence, base fallback, cross-plan isolation, base-occupancy no-charge, extra-adult, child integration, inactive/missing plan, missing base/override, policy RATE_PLAN vs PROPERTY, multi-night mixed, decimal precision). Full Jest regression deferred to the 1C-b completion gate per instruction.
- Assumptions: resolver requires an explicit ratePlanId (property-default fallback is a 1C-b3 create-time concern); applicability row is required and is the base-rate source (roomType not on plan => explicit failure). NOT started: 1C-b3.

## 2026-08-17 — Phase 1C-b3 VERIFIED: Reservation rate-plan link + immutable commercial snapshot
- Scope confirmed live: `reservations.rate_plan_id` + `reservations.rate_snapshot` (jsonb). `ReservationPricingService.buildCommercialSnapshot()` wired into create() (only when status===CONFIRMED) and confirm() (freezes only if snapshot absent). Pricing is fully isolated from inventory (never touches inventory_reserved/sold/locking/rooms).
- Snapshot shape (v1): {version, pricingStatus PRICED|UNPRICED, snapshotAt, ratePlan{id,code}, roomTypeId, mealPlan, refundable, occupancy{adults,children,baseOccupancy,extraAdults}, nights[{date,source BASE_RATE|DAILY_OVERRIDE,roomRate,extraAdultCharge,childCharge,nightTotal}], totals{room,extraAdult,child,grandTotal}, policies{<policyType>:{policy,source PROPERTY|RATE_PLAN,isActive}}, childPricing{limitations}}. UNPRICED => {reason 'NO_APPLICABLE_RATE_PLAN', ratePlanId null, NO fabricated totals}.
- OBSERVABILITY: ratePlanId/rateSnapshot are intentionally hidden by ReservationsMapper (absent on GET /reservations and /reservations/:id). They are ONLY exposed via GET /api/v1/properties/:propertyId/stays/:reservationId -> data.reservation. (UI/consumers must read from the stays endpoint.)
- ENV NOTE: the StayOS NestJS API runs on port 3001 (node dist/src/main.js, started from /entrypoint context as an unsupervised orphan — NO auto-restart, NO hot reload). The external preview URL 502s (k8s ingress expects 8001). Test against http://localhost:3001/api/v1. On this fork the live process was a STALE build predating 1C-b3; fixed via `npm run build` (tsc clean) + kill + `nohup node dist/src/main.js`. If code changes, REBUILD + restart manually (hot reload is NOT active).
- VERIFICATION (this session): focused Jest specs 151/151 (rates.service, rates.controller, rate-resolver, reservation-pricing, reservations.service, reservation-workflow, policy-resolver). Backend testing_agent iteration_12: 27/27 PASS externally-observable 1C-b flows (CRUD+validation, applicability, daily overrides, PRICED math 13000.00, DAILY_OVERRIDE vs BASE_RATE, default-plan fallback, UNPRICED, PENDING->confirm freeze, snapshot immutability, transactional rollback on inapplicable/INACTIVE/unknown plan). Inventory reconciliation AFTER = consistent (0 discrepancies, 0 invariant violations) => 1C-a untouched.
- OPEN DESIGN DECISIONS (NOT bugs; deferred for user): (1) `rate_plan_room_types.extra_child_charge` is persisted but IGNORED by RateResolverService — child charges come solely from ChildPricingService/property guest-pricing policy; with no property policy seeded, snapshot child totals = 0.00. Decide: wire extraChildCharge into resolver OR deprecate the column. (2) Post-CONFIRMED occupancy/date edits do NOT re-price (snapshot stays immutable by design => can go stale). Decide a re-price/snapshot-version strategy OR block commercial-impacting edits before billing (1D) consumes the snapshot.
- DEMO DATA: testing_agent created QA rate plans (codes QA*/SMOKEBAR) + far-future reservations; main agent cleaned up afterward — all 16 today-created reservations CANCELLED (0 hold inventory), all rate plans set INACTIVE with applicability removed and isDefault cleared (0 ACTIVE, 0 DEFAULT). NOTE: no DELETE endpoint for rate plans, so INACTIVE QA rows linger harmlessly. Property is back to effectively zero active rate plans (its pre-test state). Run bootstrap:demo only if pristine rate rows are required.
- **Phase 1C-b (Rate Plans + commercial snapshot) is COMPLETE & VERIFIED.** Next (awaiting explicit user approval, plan-first): Phase 1C-c Restrictions (stopSell/minStay/maxStay/CTA/CTD). NOT started.

## 2026-08-17 — Phase 1C-b Gap Fix A: Child Pricing (authoritative single-mechanism) — DONE & VERIFIED
- Authoritative rule implemented: a child resolves to exactly ONE active age band; that band's pricingMode is the SINGLE source of the child's per-night amount. No child is priced by more than one mechanism (no double-charge).
- New `ChildPricingMode.RATE_PLAN_EXTRA_CHILD` (migration `20260823090000`, additive `ALTER TYPE ... ADD VALUE` via DO-block, backward compatible): a band with this mode is priced from the applicable `rate_plan_room_types.extra_child_charge` per night — this is how rate-plan-specific child pricing is expressed (the previously-dead column is now wired via the resolver, NOT a second engine).
- ADULT_PRICING band + over-max-age children now correctly billed as extra adults via the rate plan's `extraAdultCharge` (fixes the old "no adult mechanism" limitation). Unified occupancy: extraOccupantsCharged = max(0, adults + adultPricedChildren - baseOccupancy); adults fill base occupancy first, adult-priced children beyond base are charged (source EXTRA_ADULT), those absorbed by base occupancy cost 0 (source BASE_OCCUPANCY_ABSORBED). Their charge lives in the extra-adult bucket only — never the child bucket.
- Snapshot now carries auditable per-child lines: `rateSnapshot.childPricing.lines[] = {age, category, source, amount}` (sources: BAND_FREE / BAND_FIXED_PER_NIGHT / BAND_PERCENT_OF_ROOM_RATE / RATE_PLAN_EXTRA_CHILD / EXTRA_ADULT / BASE_OCCUPANCY_ABSORBED / ABOVE_MAXIMUM_CHILD_AGE). occupancy gains adultPricedChildren + extraOccupantsCharged.
- Files: child-pricing-mode.enum.ts, child-pricing.service.ts (resolveChildPricing gains extraChildChargePerNight; bandSource; RATE_PLAN_EXTRA_CHILD branch; removed stale limitation), rate-resolver.service.ts (per-child accumulation, unified extra-occupant math, buildChildPricingLines, ResolvedRate.occupancy + childPricing.lines), rates.service.ts (guest-pricing-policy upsert accepts RATE_PLAN_EXTRA_CHILD, rejects it defining fixedAmount/percentage). reservation-pricing.service forwards resolved.childPricing/occupancy unchanged.
- Verified: focused specs 85/85 (child-pricing, rate-resolver, rates.service, reservation-pricing); tsc --noEmit clean; migration applied; rebuilt + restarted live API; live E2E smoke (self-cleaned): ages [4,8,14] w/ FREE/RATE_PLAN_EXTRA_CHILD/ADULT_PRICING bands + extraChildCharge 700 + extraAdultCharge 1500 over 2 nights => child 1400.00 (age 8), extraAdult 3000.00 (age 14 as EXTRA_ADULT, not double-charged), room 10000.00, grandTotal 14400.00; per-child audit lines correct. Full Jest suite intentionally NOT run (testing-budget rule).
- NOTE: no rate-plan/reservation snapshot versioning yet — Gap Fix B (dedicated append-only reservation_rate_snapshots) is APPROVED but implemented only after explicit go-ahead. Not started 1C-c/1D/POS/frontend.
