import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const stayWorkspaceSource = readFileSync(
  new URL('./components/StayWorkspace.tsx', import.meta.url),
  'utf8',
);
const roomsPageSource = readFileSync(
  new URL('../rooms/RoomsPage.tsx', import.meta.url),
  'utf8',
);

test('individual stay checkout delegates exactly one success notification to rooms redirect consumer', () => {
  const checkoutHandlerMatch = stayWorkspaceSource.match(
    /const checkOut = async \(\) => \{[\s\S]*?\n  \};/,
  );

  assert.ok(checkoutHandlerMatch, 'StayWorkspace checkout handler should be present');
  const checkoutHandler = checkoutHandlerMatch[0];

  assert.match(checkoutHandler, /await stayState\.checkOutStay\(\);/);
  assert.match(checkoutHandler, /router\.push\(`\/rooms\?\$\{query\.toString\(\)\}`\);/);
  assert.doesNotMatch(
    checkoutHandler,
    /showToast\(\{[\s\S]*title: 'Checkout complete'/,
    'StayWorkspace must not also show the redirect checkout success toast',
  );

  assert.match(
    roomsPageSource,
    /if \(searchParams\.get\('checkout'\) !== 'success'\) return;[\s\S]*window\.history\.replaceState\(null, '', '\/rooms'\);[\s\S]*showToast\(\{[\s\S]*title: 'Checkout complete'/,
    'Rooms should consume the checkout redirect URL before showing its single success toast',
  );
});
