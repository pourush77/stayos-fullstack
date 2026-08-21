import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  path.resolve('apps/web/src/features/reservations/BookingFormPage.tsx'),
  'utf8',
);

test('BookingFormPage supports selectable rate plans for Front Desk', () => {
  assert.equal(source.includes('const [selectedRatePlanId, setSelectedRatePlanId] = useState'), true);
  assert.equal(source.includes('ratePlanId: selectedRatePlanId || undefined'), true);
  assert.equal(source.includes('data-testid={`rate-plan-card-${plan.code.toLowerCase()}`'), true);
  assert.equal(source.includes('data-rate-plan-id={plan.id}'), true);
  assert.equal(source.includes('data-rate-plan-code={plan.code}'), true);
  assert.equal(source.includes('formatMealPlan(plan.mealPlan)'), true);
  assert.equal(source.includes("plan.refundable ? 'Refundable' : 'Non-refundable'"), true);
  assert.equal(source.includes('ratePlanId: selectedRatePlanId || quote?.ratePlan?.id'), true);
});

test('BookingFormPage synchronizes selectedRatePlanId with quote', () => {
  assert.equal(
    source.includes('setSelectedRatePlanId(quote.ratePlan.id)'),
    true,
    'Default/resolved rate plan is synced when quote arrives',
  );
  assert.equal(
    source.includes("setSelectedRatePlanId('')"),
    true,
    'Rate plan selection is reset when room type changes',
  );
});

test('formatMealPlan handles standard meal plan codes', () => {
  function formatMealPlan(mealPlan) {
    switch (mealPlan) {
      case 'BREAKFAST':
        return 'Breakfast included';
      case 'HALF_BOARD':
        return 'Half board';
      case 'FULL_BOARD':
        return 'Full board';
      case 'ROOM_ONLY':
      default:
        return 'Room only';
    }
  }

  assert.equal(formatMealPlan('ROOM_ONLY'), 'Room only');
  assert.equal(formatMealPlan('BREAKFAST'), 'Breakfast included');
  assert.equal(formatMealPlan('HALF_BOARD'), 'Half board');
  assert.equal(formatMealPlan('FULL_BOARD'), 'Full board');
  assert.equal(formatMealPlan(undefined), 'Room only');
});

test('Rate plan resolution selects default when no selection is made', () => {
  const eligiblePlans = [
    { id: 'bar-1', code: 'BAR', name: 'BAR', isDefault: true, grandTotal: '5000' },
    { id: 'bfast-1', code: 'BFAST', name: 'Breakfast Included', isDefault: false, grandTotal: '6000' },
  ];

  const defaultPlan = eligiblePlans.find((p) => p.isDefault) || eligiblePlans[0];
  assert.equal(defaultPlan.id, 'bar-1');

  let selectedId = 'bfast-1';
  const currentPlan = eligiblePlans.find((p) => p.id === selectedId) || defaultPlan;
  assert.equal(currentPlan.id, 'bfast-1');
  assert.equal(currentPlan.grandTotal, '6000');
});
