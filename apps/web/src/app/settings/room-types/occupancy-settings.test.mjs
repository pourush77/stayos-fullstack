import assert from 'node:assert/strict';
import { hasOccupancyErrors, occupancyPreview, validateOccupancyDraft } from './occupancy-settings.ts';

const valid = { baseOccupancy: 2, maxOccupancy: 3, maxAdults: 2, maxChildren: 1 };

assert.equal(hasOccupancyErrors(validateOccupancyDraft(valid)), false);
assert.equal(occupancyPreview(valid), 'Allows up to 2 adults + 1 child, 3 guests total');

assert.match(
  validateOccupancyDraft({ ...valid, maxOccupancy: 1 }).maxOccupancy ?? '',
  /standard occupancy/,
);

assert.match(
  validateOccupancyDraft({ ...valid, maxAdults: 4 }).maxAdults ?? '',
  /cannot exceed maximum occupancy/,
);

assert.match(
  validateOccupancyDraft({ ...valid, maxChildren: 4 }).maxChildren ?? '',
  /cannot exceed maximum occupancy/,
);

assert.equal(hasOccupancyErrors(validateOccupancyDraft({ ...valid, maxChildren: 0 })), false);

assert.match(
  validateOccupancyDraft({ ...valid, maxAdults: 0 }).maxAdults ?? '',
  /at least 1/,
);

console.log('occupancy-settings tests passed');
