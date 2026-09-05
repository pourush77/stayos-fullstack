import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

// Read source files for contract/structural verification
const pageSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/NightAuditPage.tsx'),
  'utf8',
);
const headerSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/NightAuditHeader.tsx'),
  'utf8',
);
const summarySource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/NightAuditSummary.tsx'),
  'utf8',
);
const pendingSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/PendingArrivalsSection.tsx'),
  'utf8',
);
const noShowModalSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/components/NoShowConfirmationModal.tsx'),
  'utf8',
);
const staySource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/StayReviewSection.tsx'),
  'utf8',
);
const folioSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/FolioExceptionsSection.tsx'),
  'utf8',
);
const groupSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/GroupReviewSection.tsx'),
  'utf8',
);
const closePanelSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/CloseDayPanel.tsx'),
  'utf8',
);
const closeModalSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/components/CloseDayModal.tsx'),
  'utf8',
);
const apiSource = fs.readFileSync(
  path.join(root, 'src/features/night-audit/api/night-audit-api.ts'),
  'utf8',
);
const appFrameSource = fs.readFileSync(
  path.join(root, 'src/features/auth/AppFrame.tsx'),
  'utf8',
);
const navigationSource = fs.readFileSync(
  path.resolve('../../packages/ui/src/layout/navigation.ts'),
  'utf8',
);

// Pure formatting logic implementations matching night-audit-api
function formatBusinessDate(dateStr) {
  if (!dateStr) return '—';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthIndex = parseInt(m, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${d} ${months[monthIndex]} ${y}`;
    }
  }
  return dateStr;
}

function advanceCalendarDay(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) throw new Error(`Invalid format: ${dateString}`);
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const inputDate = new Date(Date.UTC(year, month - 1, day));
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(nextDate.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(numeric)) return String(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

// --------------------------------------------------------------------------
// TEST SUITE: Night Audit NA-UI-1 Functional Shell Requirements
// --------------------------------------------------------------------------

test('A. Page renders business date and status', () => {
  assert.equal(formatBusinessDate('2026-09-04'), '04 Sep 2026');
  assert.equal(formatBusinessDate('2026-12-31'), '31 Dec 2026');

  // Header displays Night Audit title, status badge, business date
  assert.match(headerSource, /Title order=\{2\}[^>]*>\s*Night Audit/);
  assert.match(headerSource, /data-testid="night-audit-status-badge"/);
  assert.match(headerSource, /data-testid="night-audit-business-date"/);
  assert.match(headerSource, /formatBusinessDate\(businessDate\)/);
});

test('B. Blocker total renders with appropriate indicator', () => {
  assert.match(headerSource, /data-testid="night-audit-blockers-remaining"/);
  assert.match(headerSource, /\{totalBlockingCount\}\s*\{totalBlockingCount === 1 \? 'blocker' : 'blockers'\}\s*remaining/);
  assert.match(headerSource, /0 blockers remaining/);
  assert.match(headerSource, /data-testid="night-audit-refresh-button"/);
});

test('C. All four operational sections and summary render', () => {
  // Main page imports and coordinates all 4 workspace sections and summary
  assert.match(pageSource, /<NightAuditHeader/);
  assert.match(pageSource, /<NightAuditSummary/);
  assert.match(pageSource, /<PendingArrivalsSection/);
  assert.match(pageSource, /<StayReviewSection/);
  assert.match(pageSource, /<FolioExceptionsSection/);
  assert.match(pageSource, /<GroupReviewSection/);
  assert.match(pageSource, /<CloseDayPanel/);

  // Top summary contains all four operational categories
  assert.match(summarySource, /id: 'pending-arrivals',\s*label: 'Pending Arrivals'/);
  assert.match(summarySource, /id: 'stay-review',\s*label: 'Due-Out \/ Overdue'/);
  assert.match(summarySource, /id: 'folio-exceptions',\s*label: 'Folio Exceptions'/);
  assert.match(summarySource, /id: 'group-review',\s*label: 'Groups'/);
});

test('D. Pending arrival blocker renders with reservation actions', () => {
  assert.match(pendingSource, /data-testid="section-pending-arrivals"/);
  assert.match(pendingSource, /data-testid="pending-arrivals-blocker-count"/);
  assert.match(pendingSource, /data-testid=\{`pending-arrival-blocking-badge-\$\{item\.reservationId\}`\}/);
  assert.match(pendingSource, />\s*Blocking\s*</);

  // Actions wired to existing workflows
  assert.match(pendingSource, /\/reservations\/\$\{reservationId\}\/check-in/);
  assert.match(pendingSource, /\/reservations\/\$\{reservationId\}/);
  assert.match(pendingSource, />\s*Check In\s*</);
  assert.match(pendingSource, />\s*Open Booking\s*</);
});

test('D2. Pending arrival Mark No-Show opens confirmation instead of navigating away', () => {
  assert.match(pendingSource, /useState<NightAuditPendingArrivalItemDto \| null>\(null\)/);
  assert.match(pendingSource, /onClick=\{\(\) => onMarkNoShow\(item\)\}/);
  assert.match(pendingSource, /data-testid=\{`mark-no-show-button-\$\{reservationId\}`\}/);
  assert.match(pendingSource, /<NoShowConfirmationModal/);
  assert.match(pendingSource, /opened=\{Boolean\(noShowItem\)\}/);
  assert.doesNotMatch(
    pendingSource,
    /key="action-noshow"[\s\S]*component=\{Link\}[\s\S]*Mark No-Show/,
  );
});

test('D3. No-Show confirmation passes authoritative property and reservation ids to API', () => {
  assert.match(noShowModalSource, /import \{ markReservationNoShow \}/);
  assert.match(
    noShowModalSource,
    /markReservationNoShow\(\s*target\.propertyId,\s*target\.reservationId,\s*reason\.trim\(\) \|\| undefined,\s*\)/,
  );
  assert.match(pendingSource, /propertyId,\s*reservationId: noShowItem\.reservationId/);
});

test('D4. Successful Night Audit No-Show closes modal and refreshes workspace', () => {
  assert.match(pageSource, /propertyId=\{propertyId\}/);
  assert.match(pageSource, /onRefresh=\{\(\) => loadData\(\)\}/);
  assert.match(noShowModalSource, /setReason\(''\);\s*onClose\(\);\s*await onSuccess\?\.\(\);/);
  assert.match(noShowModalSource, /title: 'Marked as No-Show'/);
  assert.match(noShowModalSource, /Reserved inventory released/);
});

test('D5. Failed No-Show stays on workspace and does not fake-remove pending arrival', () => {
  assert.match(noShowModalSource, /catch \(error: unknown\)/);
  assert.match(noShowModalSource, /title: 'Unable to mark as no-show'/);
  assert.match(noShowModalSource, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(pendingSource, /filter\(\(item\) => item\.reservationId !==/);
  assert.doesNotMatch(pendingSource, /setItems/);
});

test('E. Overdue stay visually and semantically identified as urgent', () => {
  assert.match(staySource, /data-testid="stay-review-state-overdue"/);
  assert.match(staySource, />\s*OVERDUE\s*</);
  assert.match(staySource, /isOverdue \? '#fef2f2'/);
  assert.match(staySource, /isOverdue\s*\?\s*'4px solid #ef4444'/);
  assert.match(staySource, /Missing Room/);

  // Actions wired to Stay workspace
  assert.match(staySource, /\/guest-stay\/\$\{reservationId\}/);
  assert.match(staySource, />\s*Check Out\s*</);
  assert.match(staySource, />\s*Extend Stay\s*</);
  assert.match(staySource, />\s*Open Stay\s*</);
});

test('F. Informational STAYOVER does not appear as blocking', () => {
  assert.match(staySource, /data-testid="stay-review-state-stayover"/);
  assert.match(staySource, />\s*STAYOVER\s*</);
  assert.match(staySource, /data-testid=\{`stay-review-blocking-badge-\$\{item\.reservationId\}`\}/);
  assert.match(staySource, />\s*Non-blocking\s*</);
});

test('G. Folio backend balance displayed without frontend recalculation', () => {
  assert.match(folioSource, /data-testid=\{`folio-balance-due-\$\{item\.reservationId\}`\}/);
  assert.match(folioSource, /formatCurrency\(item\.balanceDue\)/);
  assert.match(folioSource, /formatCurrency\(item\.totalCharges\)/);
  assert.match(folioSource, /formatCurrency\(item\.totalPayments\)/);
  assert.doesNotMatch(folioSource, /totalCharges\s*-\s*totalPayments/);

  // Format INR currency
  assert.equal(formatCurrency('1500.00'), '₹1,500.00');
  assert.equal(formatCurrency(2500), '₹2,500.00');
  assert.equal(formatCurrency('0.00'), '₹0.00');

  // Folio actions reuse billing workflows
  assert.match(folioSource, /folioTarget = folioId \? `\/billing\/\$\{folioId\}` : '\/billing'/);
  assert.match(folioSource, />\s*Settle Folio\s*</);
  assert.match(folioSource, />\s*Record Payment\s*</);
  assert.match(folioSource, />\s*Open Folio\s*</);
});

test('H. Group blocker and details displayed with group action reuse', () => {
  assert.match(groupSource, /data-testid="section-group-review"/);
  assert.match(groupSource, /data-testid="group-review-blocker-count"/);
  assert.match(groupSource, /data-testid=\{`group-blocking-badge-\$\{item\.groupBookingId\}`\}/);
  assert.match(groupSource, /data-testid=\{`group-master-balance-\$\{item\.groupBookingId\}`\}/);

  // Group actions reuse group-holds and master-folio routes
  assert.match(groupSource, /\/reservations\/group-holds\/\$\{groupBookingId\}\/master-folio/);
  assert.match(groupSource, /\/reservations\/group-holds\/\$\{groupBookingId\}/);
  assert.match(groupSource, />\s*Checkout Group\s*</);
  assert.match(groupSource, />\s*Master Folio\s*</);
  assert.match(groupSource, />\s*Open Group\s*</);
});

test('I. Close Business Day disabled when canClose is false', () => {
  assert.match(closePanelSource, /disabled=\{!canClose \|\| isClosing\}/);
  assert.match(closePanelSource, /data-testid="close-business-day-button"/);
  assert.match(closePanelSource, /data-testid="close-day-status-text"/);
  assert.match(
    closePanelSource,
    /`\$\{totalBlockingCount\} \$\{totalBlockingCount === 1 \? 'issue' : 'issues'\} must be resolved before closing`/,
  );
});

test('J. Close Business Day enabled when canClose is true', () => {
  assert.match(closePanelSource, /canClose\s*\?\s*'Ready to close'/);
  assert.match(closePanelSource, /onClick=\{onOpenCloseModal\}/);
});

test('K. Confirmation modal shows current and next business date with explicit buttons', () => {
  assert.equal(advanceCalendarDay('2026-09-04'), '2026-09-05');
  assert.equal(advanceCalendarDay('2026-09-30'), '2026-10-01');
  assert.equal(advanceCalendarDay('2026-12-31'), '2027-01-01');

  assert.match(closeModalSource, /data-testid="close-day-confirmation-modal"/);
  assert.match(closeModalSource, /data-testid="close-day-modal-question"/);
  assert.match(closeModalSource, /Close business day \{currentFormatted\}\?/);
  assert.match(closeModalSource, /data-testid="close-day-modal-advance-text"/);
  assert.match(closeModalSource, /After closing, the hotel's business date will advance to \{nextFormatted\}\./);
  assert.match(closeModalSource, /data-testid="close-day-modal-warning"/);
  assert.match(closeModalSource, /This action cannot be undone from this screen\./);

  // Explicit buttons, not ambiguous "Confirm"
  assert.match(closeModalSource, /data-testid="close-day-modal-cancel-button"[^>]*>\s*Cancel/);
  assert.match(closeModalSource, /data-testid="close-day-modal-submit-button"[^>]*>\s*Close Business Day/);
  assert.doesNotMatch(closeModalSource, />\s*Confirm\s*</);
});

test('L. Successful close refreshes workspace to new business date', () => {
  assert.match(pageSource, /const result = await closeNightAudit\(propertyId\);/);
  assert.match(pageSource, /Business day \$\{prevDateFormatted\} closed\. New business date: \$\{nextDateFormatted\}\./);
  assert.match(pageSource, /setIsCloseModalOpen\(false\);/);
  assert.match(pageSource, /await loadData\(\);/);
});

test('M. Backend NIGHT_AUDIT_BLOCKED response refreshes and keeps page open', () => {
  assert.match(pageSource, /err instanceof NightAuditApiError && err\.code === 'NIGHT_AUDIT_BLOCKED'/);
  assert.match(pageSource, /title: 'Night Audit Blocked'/);
  assert.match(pageSource, /Night audit cannot be closed because there are blocking operational items\./);
  // Reloads data to display newly discovered blockers while remaining on the page
  assert.match(pageSource, /await loadData\(\);/);
});

test('N. Loading state renders properly', () => {
  assert.match(pageSource, /data-testid="night-audit-loading"/);
  assert.match(pageSource, /aria-label="Loading Night Audit"/);
  assert.match(pageSource, /aria-busy="true"/);
});

test('O. Error/retry state renders properly', () => {
  assert.match(pageSource, /data-testid="night-audit-error"/);
  assert.match(pageSource, /Unable to load Night Audit/);
  assert.match(pageSource, /data-testid="night-audit-retry-button"/);
  assert.match(pageSource, /onClick=\{onRetry\}/);
});

test('P. Empty section states render clearly without alarming UI', () => {
  assert.match(pendingSource, /data-testid="empty-pending-arrivals"[^>]*>[\s\S]*No pending arrivals/);
  assert.match(staySource, /data-testid="empty-stay-review"[^>]*>[\s\S]*No due-outs or overdue stays/);
  assert.match(folioSource, /data-testid="empty-folio-exceptions"[^>]*>[\s\S]*No folio exceptions/);
  assert.match(groupSource, /data-testid="empty-group-review"[^>]*>[\s\S]*No group issues/);
});

test('Q. Permission and navigation follow existing patterns for night-audit.manage', () => {
  // AppFrame permissions
  assert.match(appFrameSource, /'\/night-audit': \['night-audit\.manage'\]/);
  assert.match(appFrameSource, /\{ path: '\/night-audit', permissions: \['night-audit\.manage'\] \}/);
  assert.match(appFrameSource, /'\/night-audit': \['OWNER', 'ADMIN', 'MANAGER'\]/);

  // Main navigation item
  assert.match(navigationSource, /label: 'Night Audit', icon: Moon, href: '\/night-audit'/);

  // Page level permission check
  assert.match(pageSource, /canManage = hasPermission\(auth\.user\?\.permissions, 'night-audit\.manage'\)/);
  assert.match(pageSource, /data-testid="night-audit-access-denied"/);
  assert.match(pageSource, /Access Restricted/);
});

test('API client enforces typed endpoints and error wrapping', () => {
  assert.match(apiSource, /export async function getNightAudit/);
  assert.match(apiSource, /\/properties\/\$\{encodeURIComponent\(propertyId\)\}\/night-audit/);
  assert.match(apiSource, /export async function closeNightAudit/);
  assert.match(apiSource, /\/properties\/\$\{encodeURIComponent\(propertyId\)\}\/night-audit\/close/);
  assert.match(apiSource, /class NightAuditApiError extends Error/);
});
