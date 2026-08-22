import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('apps/web/src/features/billing/components/FolioPanel.tsx'), 'utf8');

assert.match(
  source,
  /Payment complete — ₹0 balance\. Next step: Settle the folio to close the guest account\./,
  'OPEN zero-balance guidance should clearly name settlement as the next action',
);

assert.match(
  source,
  /const isOpenZeroBalance = current\.status === 'OPEN' && isExactZero;/,
  'zero-balance settlement guidance should only target OPEN folios',
);

assert.match(
  source,
  /variant=\{isOpenZeroBalance \? 'filled' : 'light'\}/,
  'Settle Folio should become visually dominant at zero balance',
);

assert.equal(
  />\s*Next step\s*</.test(source),
  false,
  'Settle Folio should not carry a floating next-step cue',
);

assert.match(
  source,
  /disabled=\{!isExactZero \|\| isSettled \|\| \(isBillingBusy && billingAction !== 'settle'\)\}/,
  'Settle Folio should be enabled for unsettled exact-zero folios',
);

assert.match(
  source,
  /disabled=\{isSettled \|\| isBillingBusy\}/,
  'Add Charge should not be disabled merely because balance is zero',
);

assert.match(
  source,
  /previousBalance <= 0\.01 \|\| !nextIsOpenZero/,
  'attention animation should only trigger when a positive balance becomes zero',
);

assert.match(
  source,
  /animation: folio-settle-soft-pulse 850ms ease-out 3;/,
  'attention animation should be finite and subtle',
);

assert.match(
  source,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none;/,
  'reduced-motion users should not depend on animation',
);

assert.match(
  source,
  /title="Settle this folio\?"/,
  'Settle Folio should continue to open the settlement confirmation modal',
);

assert.match(
  source,
  />\s*Confirm settlement\s*</,
  'settlement should still require explicit confirmation',
);

const paymentHandler = source.slice(source.indexOf('const handleAddPayment'), source.indexOf('const handleRefund'));
assert.equal(
  paymentHandler.includes('settleFolio('),
  false,
  'recording payment should not automatically settle a zero-balance folio',
);

assert.match(
  source,
  /\$\{formatCurrency\(balance\)\} remains due\. Record a partial or full payment;/,
  'positive-balance folios should keep the normal balance-due state',
);

console.log('folio zero-balance settlement UX assertions passed');
