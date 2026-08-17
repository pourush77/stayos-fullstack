## 2026-08-17 — Phase 1E (minimum backend for frontend compatibility) — 3 MUST-HAVE items — DONE & VERIFIED
- Item 1 (overlap guard): VERIFIED already correct — `assignRoom()` calls `ensureNoOverlappingAssignment()` (proper date-overlap + active-status check). No change made (no refactor).
- Item 2 (read-only operational context): added `operational` block to the check-in workspace read model (`CheckInOperationalContextDto`): `standardCheckInTime`, `standardCheckOutTime`, derived `earlyCheckIn`, derived `lateCheckout`, `roomAssigned`. CheckInService now loads the property; flags are DETECTED only (no enforcement, no charge, no inventory/pricing impact). earlyCheckIn = arrival today & now < property check-in time & not yet checked-in; lateCheckout = checked-in & departs today & now > property check-out time.
- Item 3 (wire existing EARLY_CHECK_IN / LATE_CHECKOUT policies): new `BillingService.postPolicyChargeOnManager(manager, propertyId, reservationId, {type,description,unitAmount}, actor)` — reuses GST engine, ensures folio (creates + posts ROOM charges if absent), idempotent by (folio,type,description). New workflow helper `postLifecyclePolicyCharge` resolves the effective policy via existing PolicyResolverService + normalizePolicyCharge (FIXED_AMOUNT / PERCENTAGE / FIRST_NIGHT, base = folio active ROOM per-night). Charges are applied ONLY when the request explicitly approves (`earlyCheckIn:true` on PATCH check-in; `lateCheckout:true` on PATCH check-out) — never auto-charged by the clock. New request DTOs CheckInActionDto/CheckOutActionDto.
- IMPORTANT design point: the LATE_CHECKOUT charge is posted in its OWN committed transaction BEFORE the checkout/settlement transaction, so a blocked checkout (balance != 0 due to the late fee) does NOT roll back the charge — front desk collects it, then re-runs checkout (idempotent, no duplicate). EARLY_CHECK_IN charge is posted inside the check-in transaction (no gate to roll it back).
- Preserved: inventory entitlement vs physical roomId, READY-required check-in, checkout→NEEDS_CLEANING, exact-zero checkout gate, existing policy resolution + billing ledger, GST snapshots. No new policy types, no new billing engine, no schema change.
- Verified: focused Jest 67/67 (billing + workflow + check-in, no regression); live self-cleaning E2E /tmp/verify_lifecycle.py 14/14 — overlap guard, operational flags, early charge on explicit approval, no-charge when not approved, late charge posted before settle gate, checkout blocked until late fee paid, idempotent retry (no duplicate), settled at zero. Zero inventory invariant violations, zero residue.
- PHASE 1E MINIMUM BACKEND FOR FRONTEND COMPATIBILITY: COMPLETE. Deferred (frontend/after-P1): arrival/departure/housekeeping queue views (backend data already available), auto early/late detection enforcement, no-show auto-charge, housekeeping task workflow.


## 2026-08-17 — Phase 1D-e: GST Invoice, Credit Note, Finalization & Checkout Billing — DONE & VERIFIED
- New immutable `invoices` table (TAX_INVOICE|CREDIT_NOTE; DRAFT/FINALIZED/VOID) + `invoice_number_counters` (atomic per property+series+FY via INSERT..ON CONFLICT DO UPDATE RETURNING — never count()+1). Migration 20260930090000. Property-scoped, Indian FY-based numbering reusing existing buildInvoiceNumber/financialYearLabel + property_billing_config (prefix/resetYearly/FY-start-month). Credit notes use a separate 'CREDIT_NOTE' series ('CN-' prefix).
- `InvoiceService`: previewInvoice (read-only draft, nothing persisted), finalizeInvoice (+OnManager), issueCreditNote, voidDraftInvoice, get/list. Invoice content is built by the PURE `buildInvoiceSnapshot()` from the FROZEN folio ledger (POSTED charge lines + per-line GST snapshots + payments) — never recalculates prices/taxes; asserts line-sum == ledger grand total. Everything (seller GSTIN/state, buyer, reservation/folio refs, lines with HSN/SAC + CGST/SGST/IGST + rates, totals, payment summary) is snapshotted into JSONB so issued docs reproduce forever regardless of later folio/tax/property changes.
- Finalization is transaction-safe (pessimistic_write folio lock), idempotent (partial unique index: one non-VOID TAX_INVOICE per folio; refinalize returns the same invoice; 23505 caught), and requires an EXACTLY zero-balance (settled) folio + at least one charge (no invoice for invalid/unpriced state). FINALIZED invoices are immutable — void is rejected (409); corrections go through a linked, auditable CREDIT_NOTE (full reversal, negated totals, idempotent per original). Number allocated inside the txn (no gaps on rollback; concurrent finalizes of different folios serialized on the counter row).
- Checkout integration: checkOut() now consumes the just-settled state and finalizes the tax invoice on the SAME transaction manager (finalizeInvoiceForCheckout → finalizeInvoiceOnManager) — no nested txn, idempotent, only when folio SETTLED with charges. No recalculation.
- Preserved: 1D-a ledger/reversal, 1D-b snapshot ROOM reconciliation, 1D-c frozen GST, 1D-d payment/refund/idempotency/settlement, 1C lifecycle — all untouched (regression specs green).
- Verified: focused Jest 58/58 (invoice-snapshot.spec pure builder: ledger-sourced totals, reversal exclusion, invalid-state throw, credit-note negation; billing + workflow no regression). Live self-cleaning E2E /tmp/verify_invoices.py 24/24 covering all mandated items. Zero residue, zero inventory invariant violations. No PDF/rendering subsystem built — backend returns the full JSON invoice contract for later PDF/frontend.
- PHASE 1D COMPLETE (a/b/c/d/e). Deferred: PDF/document rendering (data contract ready), partial credit notes (full-reversal only in P1), persisted DRAFT lifecycle (read-only preview used as draft/read model; DRAFT status exists in model), guest GSTIN (B2B) capture (snapshot field present, null), reconcile-repost actor attribution (1F). Explicitly out of scope: 1E, frontend, POS, deposit policy, payment receipts.


## 2026-08-17 — Phase 1D-d: Payments, Refunds, Deposits & Settlement — DONE & VERIFIED
- Hardened the folio payment ledger (append-only, auditable). `folio_payments` gained `type` (PAYMENT|REFUND), `reversal_of_payment_id` (self-FK), `idempotency_key` (unique per folio, partial index). Migration 20260915090000 applied. Methods CASH/CARD/UPI/BANK_TRANSFER/WALLET/OTHER.
- `BillingService.addPayment`/`addRefund`/`settleFolio` are now transactional with a `pessimistic_write` row lock on the folio (serializes concurrent posts; reuses EntityManager propagation, no nested txn). Payments/refunds only on OPEN folios. Refunds are negative-amount rows linked to the original PAYMENT via reversalOfPaymentId (never edit originals); capped at original − prior refunds (prevents over-refund & double-refund). Idempotency: same (folio, key) returns the existing folio; unique-violation (23505) caught as replay — safe under retry and concurrency (live-verified 5 concurrent same-key → 1 payment).
- Balance & status are always DERIVED from charges+tax−net payments (refunds negative). Settlement requires an EXACTLY zero balance (outstanding → 400; credit/overpayment → 400 asking to refund excess first). Overpayment is explicit & safe: creates a negative balance surfaced as totals.creditBalance + paymentStatus OVERPAID, never silently discarded. New totals fields: `creditBalance`, `paymentStatus` (DUE/PARTIAL/PAID/OVERPAID). Payment DTO exposes type/reversalOfPaymentId/idempotencyKey.
- Checkout gating (reservation-workflow) tightened to EXACT zero: `ensureFolioSettledForCheckout` blocks both outstanding (>0) and credit (<0) balances (was >0.01 tolerance, silently settled credits); `settleFolioForCheckout` settles only at exactly zero. New endpoint POST /properties/:pid/folios/:folioId/refunds (BillingManage).
- Room-charge reconciliation and GST snapshots untouched (verified GST breakdown unchanged across payment ops). No invoice/PDF work.
- Verified: focused Jest 96/96 (billing + reservations + workflow, no regression); live self-cleaning E2E /tmp/verify_payments.py 22/22 covering all 12 mandated scenarios. Zero residue, zero inventory invariant violations. testing_agent NOT invoked (no defect surfaced; per user instruction).
- NEXT: Phase 1D-e (invoice generation, immutable + credit notes) — NOT started.


## 2026-08-17 — Phase 1D-c1: Indian GST engine — DONE & VERIFIED
- New configurable, effective-dated tax engine (no statutory rates hardcoded, ships EMPTY): `tax_rules` table + `TaxRuleEntity` + `GstService` (`src/core/rates/`). Rules keyed by (property, charge type) with optional per-unit tariff slabs [slabMin, slabMax], HSN/SAC, tax %, effectiveFrom, isActive. CRUD at `/properties/:pid/rates/tax-rules` (GET SettingsView|BookingsView, write SettingsManage). Migration 20260901090000 applied (tax_rules + folio_charges.hsn_sac + folio_charges.tax_snapshot jsonb).
- `GstService.computeTax()` resolves the applicable rule (greatest effectiveFrom <= charge date whose slab contains the per-unit basis; specificity + createdAt tie-break) and returns a cents-safe breakdown: INTRA_STATE => CGST+SGST (each rate/2), INTER_STATE => single IGST. Total GST computed at the configured rate FIRST then split, so CGST+SGST == exact rate% (no paisa under-collection) and components always sum to the line tax. No matching rule or zero taxable => applied:false, zero GST (never fabricated). `resolvePlaceOfSupply()` compares guest vs property state.
- Billing wired to GST (replaced flat TaxService usage): `generateRoomChargesFromSnapshot()` posts ROOM GST always INTRA_STATE, per-night rate as slab basis, and resolves the rule against the reservation ARRIVAL date (time of supply = stay; advance bookings honor a rule effective before check-in). `addCharge()` auto-computes GST per line (place of supply from guest/property state or DTO override), or honors an explicit `taxAmount` verbatim (no engine snapshot). REVERSAL rows (amendment reverse+repost, voidCharge) carry a NEGATED tax snapshot so CGST/SGST net to zero. Each charge freezes a `taxSnapshot` (taxable value, HSN/SAC, place of supply, components+rates, rule ref) + scalar `hsnSac`. Folio totals expose `taxBreakdown {cgst,sgst,igst}` aggregated from snapshots (== scalar tax).
- Verified: focused Jest 16/16 (gst.service.spec: split/slab/effective-date/no-rule/zero/odd-rate-exact-split + resolvePlaceOfSupply; billing.service.spec updated to inject GstService). Live E2E /tmp/verify_gst.py 19/19. Independent testing_agent iteration_14: 30/30 GST-slice tests, 100% backend, 0 critical (regression suite /app/backend/tests/test_gst_engine_1dc.py). Zero residue, zero inventory invariant violations.
- Fixed from testing_agent findings (both in-scope GST-correctness): ROOM effective-date basis now = arrival date (was posting date, silently ignored rules effective before check-in); odd-rate half-split now exact to configured rate.
- Accepted/deferred (by design or out of GST scope): negative unitAmount/taxAmount allowed for credit/DISCOUNT lines (intentional); no tax-rule overlap guard (deterministic latest-createdAt precedence); tax-rule read visible to BookingsView (intentional front-desk quote visibility). Attribution of reconcile repost to acting user still deferred to 1F.
- NEXT: Phase 1D-d (payments/refunds/deposits/settlement) or 1D-e (invoice generation) — awaiting user direction. Invoice PDF/format intentionally OUT of 1D-c1.


## 2026-08-17 — Phase 1D-b post-hardening: SETTLED-folio commercial-amendment block — DONE & VERIFIED
- New centralized guard `BillingService.assertCommercialAmendmentAllowedOnManager(manager, propertyId, reservationId)`: throws a controlled 409 `FOLIO_SETTLED_AMENDMENT_BLOCKED` when the reservation's folio is SETTLED (billing can no longer reconcile it). OPEN/VOID folios and no-folio do NOT block. Manager-aware + single-rule so a future authorized reopen/credit-note workflow (1D-d/1F) can relax it in one place. Does NOT reopen the folio or mutate settled financial history.
- Wired BEFORE the snapshot amend in both flows: ReservationsService.update() (inside `commercialChanged && rateSnapshotVersion != null`) and ReservationWorkflowService.postExtensionSnapshotVersion() (extendStay). Rolls back atomically. Price-affecting date/roomType/ratePlan/occupancy changes + stay extension are blocked; operational-only edits (e.g. notes) continue normally.
- Attribution: reconcile now threads actorUserId into the reposted ROOM charge (generateRoomChargesFromSnapshot gained an optional actorUserId → createdByUserId; REVERSAL row already honored it). The amendment call sites (update/extendStay) still do NOT pass actorUserId — full end-to-end attribution DEFERRED to Phase 1F (would require plumbing actorUserId through controllers; out of this slice's scope per user).
- Verified: focused Jest 96/96 (reservations.service + reservation-workflow + billing) — guard called on commercial amendments, skipped on operational edits, and a settled folio yields 409 with no amend/reconcile. Live /tmp/verify_settled_block.py: OPEN amendment still reconciles (control), date-change + rate-plan + extendStay all blocked 409 with domain code, operational edit still 200, full rollback (snapshot version + departure + folio charges unchanged), 0 residue, 0 inventory invariant violations. Full Jest NOT run; testing_agent NOT needed (no problem found). NEXT: Phase 1D-c GST engine.


## 2026-08-17 — Phase 1D-b HARDENING: automatic folio reconciliation wired into amendments — DONE & VERIFIED
- `ReservationsService.update()` and `ReservationWorkflowService.extendStay()` now call `BillingService.reconcileRoomChargesOnManager(manager, propertyId, id)` INSIDE the existing amendment transaction, guarded by `commercialChanged && rateSnapshotVersion != null && amendResult?.changed` — so it fires only when a new ACTIVE snapshot version is actually created. Same EntityManager threaded (no nested txn); rolls back with the amendment on failure.
- Reconcile is a NO-OP when the ACTIVE snapshot is UNPRICED (bare seed DB has no active rate plans) and when live POSTED snapshot-driven ROOM charges already reference the ACTIVE version (idempotent). Legacy/manual charges (rate_snapshot_id NULL) never touched.
- Verified: focused Jest specs (reservations.service.spec.ts + reservation-workflow.service.spec.ts) 88/88 — assert reconcile called only on version-changing commercial amendments, NOT on operational/no-op/rejected edits. Live self-cleaning E2E /tmp/verify_d1b_auto.py 24/24. Independent testing_agent (iteration_13) 14/14, 100% backend, 0 critical — covering date-change, rate-plan change, extendStay(CHECKED_IN), operational no-op, commercial no-op idempotency, legacy-charge preservation, no-folio case, and 422 rollback (reservation+snapshot+folio together). Zero residue, zero inventory invariant violations.
- Deferred (both OPTIONAL/minor, pre-existing — not introduced by this slice, per user scope): (1) reconcile REVERSAL/repost rows have created_by_user_id=NULL (shared gap in generateRoomChargesFromSnapshot); (2) commercial amendment on a SETTLED (non-OPEN) folio bumps snapshot version while reconcile returns early by design, with no drift signal.
- NOT started: Phase 1D-c (Indian GST engine).


## 2026-08-03 — Walk-in Group + Phase 5B
- New endpoint `POST /properties/:propertyId/operations/group-holds/walk-in` — one atomic transaction creates group + inventory blocks + room assignments + group stay + one master folio and marks rooms OCCUPIED.
- New `WalkInGroupModal.tsx` opened via "Walk-in Group" button on Bookings page. Live room picker by type, per-room occupants, deposit, notes; on success shows GRP + master folio + link.
- Phase 5B — `RoomCard` and `getRoomSubtitle` now surface `GROUP · GRP-XXXXX` badge + `${groupCode} · ${groupName}` subtitle for group-occupied rooms.
- 27 operations tests + 252 total tests passing. Build + typecheck + lint clean.


# StayOS Changelog

## 2026-08-01 (later) — Send-to-Phone + Persist Face Snap 📱
Two "one click, guided" enhancements shipped so the receptionist barely lifts a finger.

**Backend:**
- Extended `GuestDocumentSide` enum with `'GUEST_FACE'` (in addition to `'ID_FRONT' | 'ID_BACK'`).
- `mobile-capture.service.ts` accepts `GUEST_FACE` uploads; skips `syncIdentityUrls` for that side (identity table only tracks ID front/back).
- `mobile-capture.controller.ts uploadReceptionistDocument()` now accepts `type = 'front' | 'back' | 'guest_face'`.
- Public capture flow (already built in prior sessions) is now used from the desk: `POST /properties/:pid/reservations/:rid/check-in/mobile-capture` (auth) → generates a 30-min single-use token → `GET /api/v1/check-in-capture/:token` and `POST /api/v1/check-in-capture/:token/documents` (public).

**Frontend — Persist Face Snap:**
- `FaceMatchCard` now auto-uploads the webcam snapshot as a `GUEST_FACE` document the moment the receptionist clicks **Snap guest** — zero extra clicks, no separate save button. Shows a green **Saved** badge when done. On reload the persisted snap is fetched back and rendered in the GUEST tile.
- `CheckInWorkspacePage` fetches `GUEST_FACE` document as a blob URL and passes it as `persistedSnapUrl` prop; adds a `refreshWorkspace()` callback so uploads roundtrip cleanly.

**Frontend — Send to Phone:**
- New `SendToPhoneModal` component: one **Send to phone** button in Step 1 → modal creates the session → renders a big scannable QR (via `qrcode.react`) plus a **Copy** fallback and STATUS pills for `ID front` / `ID back`.
- Modal polls `GET /check-in/mobile-capture/status` every 3s; when the phone uploads, shows a green toast and calls `refreshWorkspace()` — the desk workspace updates + OCR fires automatically.
- New public route `/mobile-capture/[token]` (`MobileCapturePage`): mobile-optimised card with two giant **Snap** buttons that open the phone's rear camera via `<input capture="environment">`, uploads via the public endpoint, and shows "All set!" when both sides are captured.
- Public routes added to auth-guard allow-list in both `AppFrame.tsx` and `auth-context.tsx`.

**Verified end-to-end (curl + Playwright):**
- Session create → returns token, expires in 30 min. `POST /check-in-capture/:token/documents` succeeds with `HTTP 201`, `frontUploaded=true`.
- Send-to-Phone modal renders QR + STATUS pills; auto-polls; toast surfaces when guest uploads.
- Phone page (420×900 viewport) loads guest name + booking; shows **SENT** badge on uploaded sides.
- FaceMatchCard auto-persists snap → workspace reload restores it.

## 2026-08-01 — V1 Launch Ready 🚀
(Prior entry — see below.)
Full regression pass certified StayOS V1 for real hospitality staff use.

**Backend fixes (rebuilt + restarted):**
- `role-permissions.ts` — granted `HousekeepingView`, `EmployeesView`, `MaintenanceView` to `FRONT_DESK` (per persona: FD needs housekeeping visibility to know which rooms are ready).
- `razorpay.service.ts` — unconfigured Razorpay now returns `503 ServiceUnavailable` (was `500`) with a friendly "collect at reception" message.

**Frontend fixes (Next.js hot-reload picks up automatically):**
- **HIGH — production blocker:** `packages/ui/src/layout/stayos-app-shell.tsx` `apiBaseUrl()` now references `process.env.NEXT_PUBLIC_API_BASE_URL` directly instead of via `globalThis.process?.env` (Next.js only inlines literal `process.env.NEXT_PUBLIC_*` at build time; the indirect lookup silently fell back to `http://localhost:3002` and every browser page fired `ERR_CONNECTION_REFUSED` on `/properties`, showing wrong room count in sidebar).
- `app/settings/layout.tsx` (new) — client-side role guard: only `OWNER | ADMIN | MANAGER` may open `/settings/**`; others redirect to `/front-desk`.
- `features/employees/components/EmployeesPage.tsx` — removed plaintext "run npm run bootstrap:demo-employees / Password123! / Gaurav Gaur" credential leak.
- `features/reservations/BookingDetailPage.tsx` — `AssignRoomModal` now accepts `mode: 'assign' | 'move'`; Move Room modal shows correct title + CTA + placeholder.
- `features/reservations/components/CheckoutModal.tsx` — checks `GET /razorpay/config`; hides "Charge via Razorpay" button + swaps help text to cash/card/UPI-at-reception when Razorpay is not configured.
- `app/check-in/page.tsx` — legacy `/check-in?reservationId=` route now redirects to `/reservations/:id/check-in` (preserves old bookmarks; kills 404 chatter).
- `features/guests/GuestFormPage.tsx` — removed duplicate `हिन्दी` language chip.
- `app/login/page.tsx` — added `login-email`, `login-password`, `login-submit` data-testids.
- `app/housekeeping/page.tsx` — removed the "Complete on behalf" button from Needs-Cleaning (not-started) cards which previously caused silent 400s.

**Testing (2 rounds via testing_agent_v3_fork):**
- Backend: **61/61 pytest cases pass** (`/app/tests/stayos_regression_test.py`).
- Frontend: 8/8 targeted regression fixes verified in Playwright + 4/4 sanity flows pass (booking → check-in blockers → billing add-charge/collect-payment → checkout → receipt.pdf; housekeeping Assign → Start → Complete → Inspect → Mark Ready).
- Zero `localhost:3002` console errors after the app-shell fix.

**Deferred to P1/P2 (not blockers for launch):**
- Housekeeping Inspect modal: pre-load the housekeeper's submitted checklist.
- Availability Calendar: empty-cell click → prefilled New Booking + populate `roomTypeName`.
- CheckIn workspace: native DoB input → Mantine DateInput.
- Repo-wide lint cleanup.
- Housekeeping mutation error toasts.

## 2026-07-30 → 2026-07-31 — Feature build sprint
Extensive feature work by prior agents — Auth, User Management, Billing (folios/charges/payments/PDF receipts), Rooms, Guests, Reservations (New Booking + Detail + Check-In Workspace with client-side OCR + Face-Match), Availability Calendar, Extend Stay, Move Room, Razorpay integration, Housekeeping Board with staff QR access. See PRD.md sessions ledger for detail.
