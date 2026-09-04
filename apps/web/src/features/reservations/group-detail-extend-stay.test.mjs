import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const detailPageSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/GroupHoldDetailPage.tsx'),
  'utf8',
);
const bookingsPageSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/BookingsPage.tsx'),
  'utf8',
);
const groupExtendModalSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/components/GroupExtendStayModal.tsx'),
  'utf8',
);

test('checked-in group detail shows Extend Stay in the operational action area', () => {
  assert.match(detailPageSource, /const canExtendStay = hold\?\.status === 'CHECKED_IN'/);
  assert.match(
    detailPageSource,
    /hold\.status === 'CHECKED_IN' \? \([\s\S]*Complete Checkout[\s\S]*\{canExtendStay \? \([\s\S]*Extend Stay[\s\S]*Open Folio/,
  );
});

test('terminal group detail states do not show Extend Stay', () => {
  const gateStart = detailPageSource.indexOf('const canExtendStay =');
  const gateEnd = detailPageSource.indexOf('const openExtendStay', gateStart);
  const gateSource = detailPageSource.slice(gateStart, gateEnd);

  assert.ok(gateStart >= 0);
  assert.ok(gateEnd > gateStart);
  assert.doesNotMatch(gateSource, /CHECKED_OUT|CANCELLED|NO_SHOW|RELEASED/);
});

test('group detail reuses the existing group extension flow and refreshes after success', () => {
  assert.match(bookingsPageSource, /<GroupExtendStayModal/);
  assert.match(detailPageSource, /<GroupExtendStayModal/);
  assert.match(detailPageSource, /extendGroupStay\(propertyId, hold\.id, extendDepartureDate\)/);
  assert.match(detailPageSource, /await load\(propertyId\)/);
  assert.match(groupExtendModalSource, /title="Extend group stay"/);
  assert.match(groupExtendModalSource, />\s*Extend Stay\s*</);
  assert.match(
    groupExtendModalSource,
    /disabled=\{!departureDate \|\| \(group \? departureDate <= group\.departureDate : true\)\}/,
  );
});
