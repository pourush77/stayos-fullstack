import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const bookingsPageSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/BookingsPage.tsx'),
  'utf8',
);
const activeGroupsSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/components/ActiveGroupsSection.tsx'),
  'utf8',
);

test('bookings page shows active groups above the normal bookings table', () => {
  assert.match(bookingsPageSource, /import \{ ActiveGroupsSection \}/);
  assert.match(bookingsPageSource, /<ActiveGroupsSection groups=\{groupHolds\} today=\{today\} \/>/);
  assert.ok(
    bookingsPageSource.indexOf('<ActiveGroupsSection groups={groupHolds} today={today} />') <
      bookingsPageSource.indexOf('<Table.ScrollContainer minWidth={1080}>'),
  );
});

test('active groups section ranks active upcoming groups by nearest arrival', () => {
  assert.match(activeGroupsSource, /export function getActiveGroupsForBookingsPage/);
  assert.match(activeGroupsSource, /group\.status === 'ON_HOLD' \|\| group\.status === 'CONFIRMED'/);
  assert.match(activeGroupsSource, /group\.departureDate >= today/);
  assert.match(activeGroupsSource, /a\.arrivalDate\.localeCompare\(b\.arrivalDate\)/);
  assert.match(activeGroupsSource, /View group/);
});

test('default bookings table does not duplicate group rows unless searching or filtering', () => {
  assert.match(bookingsPageSource, /const shouldShowGroupRows = normalized\.length > 0 \|\| filter !== 'all'/);
  assert.match(bookingsPageSource, /if \(!shouldShowGroupRows\) return \[\]/);
  assert.match(bookingsPageSource, /groupMatchesFilter\(group, filter\)/);
});
