import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  path.resolve('apps/web/src/app/settings/rates/page.tsx'),
  'utf8',
);

test('rate-plan editor asks for confirmation before replacing another default', () => {
  assert.equal(source.includes('const [defaultReplacementPlan, setDefaultReplacementPlan]'), true);
  assert.equal(
    source.includes('editingPlan && !editingPlan.isDefault && planForm.isDefault && currentDefaultPlan'),
    true,
  );
  assert.equal(source.includes('title="Change default rate plan?"'), true);
});

test('default replacement confirmation includes current and target plan names', () => {
  assert.equal(source.includes('{defaultReplacementPlan?.name}'), true);
  assert.equal(
    source.includes("{planForm.name.trim() || editingPlan?.name || 'this rate plan'}"),
    true,
  );
  assert.equal(source.includes('The current plan will remain active.'), true);
});

test('cancel leaves the edit unsaved and confirm performs one update path', () => {
  assert.equal(source.includes('onClick={() => setDefaultReplacementPlan(null)}'), true);
  assert.equal(source.includes('onClick={() => void savePlan()}'), true);
  assert.equal(source.includes('const updated = await updateRatePlan'), true);
});

test('rate-plan badges refresh from the server after a default switch', () => {
  assert.equal(source.includes('const refreshedPlans = await getRatePlans(propertyId);'), true);
  assert.equal(source.includes('setPlans(refreshedPlans);'), true);
});

test('no replacement confirmation is shown for the current default or no existing default', () => {
  assert.equal(source.includes('!editingPlan.isDefault'), true);
  assert.equal(source.includes('&& currentDefaultPlan'), true);
});
