import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const reportPage = fs.readFileSync(path.join(root, 'src/app/reports/page.tsx'), 'utf8');
const listRoute = fs.readFileSync(path.join(root, 'src/app/reports/night-audit-history/page.tsx'), 'utf8');
const detailRoute = fs.readFileSync(path.join(root, 'src/app/reports/night-audit-history/[runId]/page.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/features/reports/api/reports-api.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/features/reports/components/NightAuditHistoryPage.tsx'), 'utf8');

test('Reports exposes Night Audit History', () => {
  assert.match(reportPage, /value="night-audit-history"/);
  assert.match(reportPage, /Night Audit History/);
  assert.match(reportPage, /href="\/reports\/night-audit-history"/);
});

test('list route renders the history page and calls the backend API', () => {
  assert.match(listRoute, /NightAuditHistoryListPage/);
  assert.match(api, /getNightAuditHistory/);
  assert.match(api, /\/reports\/night-audit-history/);
  assert.match(page, /data-testid="night-audit-history-table"/);
});

test('newest rows render sectionCounts from API data', () => {
  assert.match(api, /sectionCounts: NightAuditHistorySectionCounts/);
  assert.match(page, /row\.sectionCounts\.pendingArrivals/);
  assert.match(page, /row\.sectionCounts\.stayReview/);
  assert.match(page, /row\.sectionCounts\.folioExceptions/);
  assert.match(page, /row\.sectionCounts\.groupReview/);
});

test('View Report opens detail route', () => {
  assert.match(page, /View Report/);
  assert.match(page, /\/reports\/night-audit-history\/\$\{row\.runId\}/);
  assert.match(detailRoute, /NightAuditHistoryDetailPage/);
  assert.match(api, /getNightAuditHistoryDetail/);
});

test('snapshot detail renders operational completion snapshot', () => {
  assert.match(page, /data-testid="night-audit-snapshot-detail"/);
  assert.match(page, /Business Date/);
  assert.match(page, /Next Business Date/);
  assert.match(page, /Snapshot \{snapshot\.version\}/);
  assert.match(page, /Close Result/);
  assert.match(page, /Operational Summary/);
  assert.match(page, /Successful close/);
  assert.match(page, /Final operational record for the closed business day\./);
  assert.match(page, /Pending Arrivals/);
  assert.match(page, /Stay Review/);
  assert.match(page, /Folio Exceptions/);
  assert.match(page, /Group Issues/);
  assert.match(page, /In-House Summary/);
});

test('snapshot detail polish avoids raw user ids and duplicate reservation columns', () => {
  assert.match(page, /userLabel/);
  assert.match(page, /Name not available/);
  assert.match(page, /Closed by \/ time/);
  assert.match(page, /formatDisplayDate/);
  assert.match(page, /\['reservation', 'departureDate', 'reviewState', 'roomNumber'\]/);
  assert.doesNotMatch(page, /columns=\{\['confirmationNumber', 'reservationCode'/);
});

test('legacy row and detail show limited-history treatment', () => {
  assert.match(page, /row\.hasSnapshot \? row\.completionSnapshotVersion : 'Legacy'/);
  assert.match(page, /data-testid="night-audit-legacy-notice"/);
  assert.match(page, /Limited historical data/);
  assert.match(page, /legacySummary/);
});

test('new Night Audit history UI does not render banned financial metric labels', () => {
  assert.doesNotMatch(page, /room revenue/i);
  assert.doesNotMatch(page, /tax totals?/i);
  assert.doesNotMatch(page, /payments?/i);
  assert.doesNotMatch(page, /refunds?/i);
  assert.doesNotMatch(page, /nightly charge totals?/i);
});

test('API error and empty states are present', () => {
  assert.match(page, /data-testid="night-audit-history-error"/);
  assert.match(page, /Retry/);
  assert.match(page, /data-testid="night-audit-history-empty"/);
  assert.match(page, /data-testid="night-audit-report-error"/);
});
