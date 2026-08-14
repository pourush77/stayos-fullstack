import assert from 'node:assert/strict';

const { roomCapacityLabel, roomCapacityMessage } = await import('./room-capacity.ts');

const deluxe = {
  baseRate: 3500,
  capacity: 3,
  id: 'deluxe',
  label: 'Deluxe',
  maxAdults: 2,
  maxChildren: 1,
  maxOccupancy: 3,
};

assert.equal(roomCapacityMessage(deluxe, 2, 1), undefined, 'valid occupancy passes');
assert.equal(
  Boolean(roomCapacityMessage(deluxe, 2, 2)),
  true,
  'changing occupancy can make selected room invalid',
);
assert.equal(
  roomCapacityMessage(deluxe, 2, 1),
  undefined,
  'reducing occupancy makes selected room valid again',
);
assert.equal(
  roomCapacityMessage(deluxe, 2, 2),
  'Deluxe allows up to 1 child.',
  'children over maxChildren gets the specific child message',
);
assert.equal(
  roomCapacityMessage(deluxe, 3, 0),
  'Deluxe allows up to 2 adults.',
  'adults over maxAdults gets the specific adult message',
);
assert.equal(
  roomCapacityMessage({ ...deluxe, maxAdults: 4, maxChildren: 4 }, 2, 2),
  'Deluxe accommodates up to 3 guests. Reduce the number of guests or choose another room type.',
  'total guests over maxOccupancy gets total capacity message',
);
assert.equal(roomCapacityMessage(deluxe, 2, 0), undefined, 'adult-only existing flow remains valid');
assert.equal(roomCapacityLabel(deluxe), 'Max 2A / 1C');

console.log('room-capacity assertions passed');
