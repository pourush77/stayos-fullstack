import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const detailSource = fs.readFileSync(
  path.resolve('apps/web/src/features/reservations/BookingDetailPage.tsx'),
  'utf8',
);
const mapperSource = fs.readFileSync(
  path.resolve('apps/web/src/features/reservations/utils/booking-mappers.ts'),
  'utf8',
);
const billingSource = fs.readFileSync(
  path.resolve('stayos-api/src/core/billing/billing.service.ts'),
  'utf8',
);

test('Booking Details renders selected booked rate-plan metadata', () => {
  assert.equal(detailSource.includes('Section title="Rate Plan"'), true);
  assert.equal(detailSource.includes('label="Rate plan"'), true);
  assert.equal(detailSource.includes('label="Meal plan"'), true);
  assert.equal(detailSource.includes('label="Cancellation"'), true);
  assert.equal(detailSource.includes('label="Booked rate"'), true);
  assert.equal(detailSource.includes('formatRatePlanLabel(booking.ratePlan)'), true);
});

test('Booking Details displays canonical meal and refundable labels', () => {
  assert.equal(detailSource.includes("case 'BREAKFAST':"), true);
  assert.equal(detailSource.includes("return 'Breakfast included'"), true);
  assert.equal(detailSource.includes("case 'ROOM_ONLY':"), true);
  assert.equal(detailSource.includes("return 'Room only'"), true);
  assert.equal(detailSource.includes("if (refundable === true) return 'Refundable'"), true);
  assert.equal(detailSource.includes("if (refundable === false) return 'Non-refundable'"), true);
});

test('Booking mapper uses persisted bookedRatePlan instead of live manager settings', () => {
  assert.equal(mapperSource.includes("getRecord(dto, ['bookedRatePlan'])"), true);
  assert.equal(mapperSource.includes("getRecord(dto, ['ratePlan'])"), false);
  assert.equal(mapperSource.includes('typeof bookedRatePlan.refundable ==='), true);
});

test('Folio room charge description includes persisted rate plan and preserves snapshot audit', () => {
  assert.equal(billingSource.includes('buildRoomChargeDescription'), true);
  assert.equal(billingSource.includes('Room charges · ${planLabel}'), true);
  assert.equal(billingSource.includes('(snapshot v${snapshotVersion})'), true);
});
