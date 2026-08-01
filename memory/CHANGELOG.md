# StayOS Changelog

## 2026-08-01 — V1 Launch Ready 🚀
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
