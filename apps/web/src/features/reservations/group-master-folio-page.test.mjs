import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, 'src/features/reservations/GroupMasterFolioPage.tsx'),
  'utf8',
);

test('group master folio redirects and refreshes after checkout succeeds', () => {
  assert.match(source, /import \{ useRouter \} from 'next\/navigation';/);
  assert.match(source, /showToast/);
  assert.match(source, /const router = useRouter\(\);/);
  assert.match(
    source,
    /const checkedOutRoomCount = folio\.checkoutSummary\.occupiedRoomCount;[\s\S]*await completeGroupCheckout\(propertyId, groupBookingId\);/,
  );
  assert.match(
    source,
    /showToast\(\{[\s\S]*color: 'green'[\s\S]*message: `\$\{next\.groupName\} · \$\{checkedOutRoomCount\} rooms checked out`[\s\S]*title: 'Checkout complete'[\s\S]*\}\);/,
  );
  assert.match(source, /router\.push\('\/reservations'\);/);
  assert.match(source, /router\.refresh\(\);/);
});
