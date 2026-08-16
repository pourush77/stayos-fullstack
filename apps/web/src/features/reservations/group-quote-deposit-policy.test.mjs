import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  path.resolve('apps/web/src/features/reservations/GroupQuotePage.tsx'),
  'utf8',
);

test('GroupQuotePage does not contain the old hardcoded 20 percent deposit rule', () => {
  assert.equal(source.includes('quoteTotal * 0.2'), false);
  assert.equal(source.includes('* 0.2'), false);
});

test('GroupQuotePage displays the backend deposit explanation', () => {
  assert.equal(source.includes('depositExplanation('), true);
  assert.equal(source.includes('selectedOption.deposit'), true);
  assert.equal(source.includes('option.deposit.suggestedAmount'), true);
});
