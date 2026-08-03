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
