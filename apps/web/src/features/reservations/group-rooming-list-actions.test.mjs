import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const detailSource = fs.readFileSync(
  path.join(root, 'src/features/reservations/GroupHoldDetailPage.tsx'),
  'utf8',
);
const apiSource = fs.readFileSync(path.join(root, 'src/lib/operations-api.ts'), 'utf8');

test('group hold detail exposes backend-backed rooming-list edit and delete actions', () => {
  assert.match(detailSource, /updateGroupRoomingListItem/);
  assert.match(detailSource, /deleteGroupRoomingListItem/);
  assert.match(detailSource, /aria-label=\{`Edit \$\{item\.guestName\}`\}/);
  assert.match(detailSource, /aria-label=\{`Delete \$\{item\.guestName\}`\}/);
  assert.match(detailSource, /title="Edit Guest"/);
  assert.match(detailSource, /title="Delete Guest"/);
  assert.match(detailSource, /Permanent action/);
});

test('operations API targets item-specific rooming-list PATCH and DELETE endpoints', () => {
  assert.match(apiSource, /export function updateGroupRoomingListItem/);
  assert.match(apiSource, /patch<GroupHoldDto>/);
  assert.match(apiSource, /operations\/group-holds\/\$\{groupHoldId\}\/rooming-list\/\$\{itemId\}/);
  assert.match(apiSource, /export function deleteGroupRoomingListItem/);
  assert.match(apiSource, /del<GroupHoldDto>/);
});
