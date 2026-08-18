# StayOS --- Next Tasks

**Updated:** 18 August 2026\
**Current milestone:** Post--Phase 1 Production Hardening

Status values: `TODO` · `IN PROGRESS` · `DONE` · `BLOCKED`

## P0 --- Production Hardening

### P0-1 Property Timezone & Business-Date Correctness

**Status:** TODO\
**Next task**

- Audit property timezone source of truth
- Remove server/browser-local assumptions from hotel operational
  decisions
- Verify arrival/departure date boundaries
- Verify early check-in and late checkout calculations
- Verify business-date-sensitive Front Desk queries
- Verify billing timestamps where operational date matters
- Add focused timezone boundary tests

**Exit:** Operational decisions remain correct regardless of
server/browser timezone.

### P0-2 Authentication & RBAC Hardening

**Status:** TODO

- Review frontend route permissions
- Review backend endpoint guards
- Verify Front Desk / Manager / Accounts boundaries
- Verify cross-property isolation
- Ensure privileged billing and operational mutations require correct
  permissions
- Add focused authorization tests

**Exit:** Users cannot read or mutate data outside their role/property
entitlement.

### P0-3 Refund / Credit Flow

**Status:** TODO

- Define refund vs credit-note behavior
- Define settled-folio correction rules
- Preserve immutable audit history
- Verify payment/refund balance calculations
- Add UI only after backend accounting rules are stable

**Exit:** Post-payment corrections are auditable and do not rewrite
financial history.

### P0-4 Invoice Numbering & Immutability

**Status:** TODO

- Define property-scoped numbering
- Prevent duplicate invoice numbers
- Define invoice finalization point
- Prevent mutation of finalized invoices
- Define correction/credit-note path

**Exit:** Finalized invoices are uniquely numbered, immutable and
auditable.

### P0-5 Scheduled Inventory Reconciliation & Alerting

**Status:** TODO

- Reuse existing reconciliation service
- Schedule periodic reconciliation
- Log discrepancy categories
- Alert only on genuine inconsistency
- Keep reconciliation observational unless an explicit repair
  mechanism is approved

**Exit:** Inventory drift is automatically detected without manual Front
Desk calls.

### P0-6 Database Backup / Restore Drill

**Status:** TODO

- Define backup mechanism and retention
- Perform test backup
- Restore into isolated environment
- Verify critical PMS entities after restore
- Document recovery procedure

**Exit:** A tested restore procedure exists before pilot usage.

---

## P1 --- UX & Operational Polish

**Status:** TODO

- Standardize skeleton/loading states
- Standardize API mutation progress states
- Remove duplicate success notifications
- Improve actionable error messages
- Complete Email Bill flow
- Complete WhatsApp Bill flow
- Review historical folio/bill UX
- Continue payment modal polish
- Review empty states and disabled-action explanations

---

## P2 --- POS Foundation

**Status:** TODO

Start only after critical P0 hardening is under control.

Initial scope: - Outlet model - Menu/category/item model - Order
lifecycle - Room-posting integration - Folio charge integration -
Void/discount authorization - Audit trail - Basic outlet
settlement/reporting

---

## P3 --- Channel Manager Foundation

**Status:** TODO

Build provider-neutral domain boundaries before implementing a specific
provider.

Initial scope: - Channel/provider abstraction - Property/channel
mapping - Room-type/rate-plan mapping - Availability/rate/restriction
outbound updates - Reservation inbound ingestion - Idempotency and
duplicate protection - Retry/dead-letter handling - Sync status and
audit history

After the foundation is stable, select and integrate the first real
channel provider.

---

## Immediate Execution Order

`P0-1 Timezone → P0-2 RBAC → P0-3 Refund/Credit → P0-4 Invoice → P0-5 Reconciliation Automation → P0-6 Backup/Restore → P1 UX → POS → Channel Manager`

Keep each task small: inspect existing implementation first, close only
verified gaps, run focused tests, then move on.
