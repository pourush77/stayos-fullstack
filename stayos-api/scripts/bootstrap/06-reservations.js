const { iso, mapBy, reservationCode, seedKey } = require('./00-utils');

const scenarios = [
  ['Today arrival confirmed unassigned Deluxe paid', 0, 1, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 1, 0, 'Paid business traveler.'],
  ['Today arrival confirmed assigned room 201 paid', 0, 2, 'DLX', '201', 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Assigned arrival.'],
  ['Today arrival confirmed assigned room 202 payment due', 0, 2, 'DLX', '202', 'DIRECT', 'CONFIRMED', 'PAYMENT_DUE', 2, 0, 'Payment due on arrival.'],
  ['Today arrival family booking Suite unassigned', 0, 3, 'STE', null, 'DIRECT', 'CONFIRMED', 'PARTIALLY_PAID', 2, 1, 'Family booking.'],
  ['Today arrival VIP guest Suite assigned room 212', 0, 2, 'STE', '212', 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'VIP arrival.'],
  ['Tomorrow arrival confirmed unassigned', 1, 3, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAYMENT_DUE', 1, 0, 'Tomorrow arrival.'],
  ['Future booking next week', 7, 10, 'DLX', null, 'WEBSITE', 'CONFIRMED', 'PARTIALLY_PAID', 2, 0, 'Next week booking.'],
  ['OTA booking', 3, 5, 'DLX', null, 'OTA', 'CONFIRMED', 'PAID', 2, 0, 'OTA booking.'],
  ['Direct booking', 4, 6, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Direct booking.'],
  ['Corporate booking', 2, 5, 'DLX', null, 'CORPORATE', 'CONFIRMED', 'PAYMENT_DUE', 1, 0, 'Corporate billing.'],
  ['Walk-in booking created today', 0, 1, 'DLX', null, 'WALK_IN', 'CONFIRMED', 'PAID', 1, 0, 'Walk-in booking.'],
  ['Pending booking', 5, 7, 'DLX', null, 'DIRECT', 'PENDING', 'PAYMENT_DUE', 2, 0, 'Pending confirmation.'],
  ['Cancelled booking', 6, 8, 'DLX', null, 'DIRECT', 'CANCELLED', 'PAYMENT_DUE', 2, 0, 'Cancelled by guest.'],
  ['Booking with accessibility request', 1, 4, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 1, 0, 'Accessibility request.'],
  ['Booking with early check-in request', 2, 4, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Early check-in requested.'],
  ['Booking with late checkout request', 2, 4, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Late checkout requested.'],
  ['Booking with extra bed request', 3, 6, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PARTIALLY_PAID', 2, 0, 'Extra bed requested.'],
  ['Booking with airport pickup request', 4, 7, 'STE', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Airport pickup requested.'],
  ['Booking with high floor request', 5, 8, 'STE', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'High floor requested.'],
  ['Booking with quiet room request', 5, 8, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 1, 0, 'Quiet room requested.'],
  ['Checked-in stay in room 303', -1, 2, 'STE', '303', 'DIRECT', 'CHECKED_IN', 'PAID', 2, 0, 'Active stay.'],
  ['Checked-in stay in room 306', -2, 1, 'DLX', '306', 'DIRECT', 'CHECKED_IN', 'PAID', 1, 0, 'Active stay.'],
  ['Checked-in VIP stay', -1, 3, 'STE', null, 'DIRECT', 'CHECKED_IN', 'PAID', 2, 0, 'VIP in-house.'],
  ['Checked-in guest with payment due', -1, 2, 'DLX', null, 'DIRECT', 'CHECKED_IN', 'PAYMENT_DUE', 1, 0, 'In-house payment due.'],
  ['Checked-in guest expected checkout today', -2, 0, 'DLX', null, 'DIRECT', 'CHECKED_IN', 'PAID', 2, 0, 'Expected checkout today.'],
  ['Checked-in guest expected checkout tomorrow', -2, 1, 'DLX', null, 'DIRECT', 'CHECKED_IN', 'PAID', 2, 0, 'Expected checkout tomorrow.'],
  ['Checked-out booking that moved room 203 to NEEDS_CLEANING', -3, -1, 'DLX', '203', 'DIRECT', 'CHECKED_OUT', 'PAID', 2, 0, 'Checkout completed.'],
  ['Checked-out booking that moved room 204 to NEEDS_CLEANING', -3, -1, 'DLX', '204', 'DIRECT', 'CHECKED_OUT', 'PAID', 2, 0, 'Checkout completed.'],
  ['Checked-out booking that moved room 206 to INSPECTION', -4, -1, 'DLX', '206', 'DIRECT', 'CHECKED_OUT', 'PAID', 2, 0, 'Inspection pending.'],
  ['Checked-out booking with housekeeping assigned to Kaju', -4, -1, 'DLX', '204', 'DIRECT', 'CHECKED_OUT', 'PAID', 1, 0, 'Assigned to Kaju.'],
  ['Checked-out booking with cleaning started by Deepak', -4, -1, 'DLX', '207', 'DIRECT', 'CHECKED_OUT', 'PAID', 1, 0, 'Cleaning started by Deepak.'],
  ['Room waiting inspection completed by Ram', -4, -1, 'DLX', '206', 'DIRECT', 'CHECKED_OUT', 'PAID', 1, 0, 'Waiting inspection.'],
  ['Room sent back for rework', -4, -1, 'DLX', '209', 'DIRECT', 'CHECKED_OUT', 'PAID', 1, 0, 'Rework required.'],
  ['Long stay 7+ nights', 1, 9, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PARTIALLY_PAID', 1, 0, 'Long stay.'],
  ['Child occupancy booking', 2, 5, 'STE', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 1, 'Child occupancy.'],
  ['Suite booking at capacity', 3, 6, 'STE', null, 'DIRECT', 'CONFIRMED', 'PAID', 3, 1, 'Suite at capacity.'],
  ['Deluxe booking at capacity', 3, 5, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Deluxe at capacity.'],
  ['Payment due booking', 4, 6, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAYMENT_DUE', 2, 0, 'Payment due.'],
  ['Paid booking', 4, 6, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 2, 0, 'Paid booking.'],
  ['Cancelled paid booking', 5, 7, 'DLX', null, 'DIRECT', 'CANCELLED', 'PAID', 2, 0, 'Cancelled paid booking.'],
  ['No-show placeholder if backend status supports it', -1, 1, 'DLX', null, 'DIRECT', 'NO_SHOW', 'PAYMENT_DUE', 1, 0, 'No-show placeholder.'],
  ['Past completed stay', -10, -8, 'DLX', null, 'DIRECT', 'CHECKED_OUT', 'PAID', 2, 0, 'Past completed stay.'],
  ['Future OTA family booking', 10, 13, 'STE', null, 'OTA', 'CONFIRMED', 'PARTIALLY_PAID', 2, 1, 'Future OTA family.'],
  ['Returning guest second booking', 14, 17, 'DLX', null, 'DIRECT', 'CONFIRMED', 'PAID', 1, 0, 'Returning guest second booking.'],
  ['Extra future corporate booking', 12, 15, 'DLX', null, 'CORPORATE', 'CONFIRMED', 'PAYMENT_DUE', 1, 0, 'Corporate QA extra.'],
  ['Extra website booking', 15, 17, 'STE', null, 'WEBSITE', 'PENDING', 'PAYMENT_DUE', 2, 0, 'Website QA extra.'],
];

async function run(client, ctx) {
  console.log('Skipped unsupported scenario: Same-day arrival/departure attempt should not be created unless backend allows day-use');
  const guests = Array.from((await mapBy(client, 'SELECT * FROM guests WHERE property_id = $1 ORDER BY created_at, display_name', [ctx.property.id], 'phone')).values());
  let updated = 0;

  for (let index = 0; index < scenarios.length; index += 1) {
    const [name, arrive, depart, roomTypeCode, roomNumber, source, status, payment, adults, children, request] = scenarios[index];
    const key = `RSV-${String(index + 1).padStart(3, '0')}`;
    const roomType = ctx.roomTypes.get(roomTypeCode);
    const room = roomNumber ? ctx.rooms.get(roomNumber) : null;
    const guest = guests[index % guests.length];
    const notes = `${seedKey(key)} ${name}`;
    const code = await reservationCode(client, ctx.property.id, index + 1);
    await client.query(
      `
        INSERT INTO reservations (
          property_id, guest_id, reservation_code, arrival_date, departure_date, adults,
          children, room_type_id, room_id, source, status, payment_status, notes, special_requests
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (property_id, reservation_code) DO UPDATE SET
          guest_id = EXCLUDED.guest_id,
          arrival_date = EXCLUDED.arrival_date,
          departure_date = EXCLUDED.departure_date,
          adults = EXCLUDED.adults,
          children = EXCLUDED.children,
          room_type_id = EXCLUDED.room_type_id,
          room_id = EXCLUDED.room_id,
          source = EXCLUDED.source,
          status = EXCLUDED.status,
          payment_status = EXCLUDED.payment_status,
          notes = EXCLUDED.notes,
          special_requests = EXCLUDED.special_requests,
          updated_at = now()
      `,
      [
        ctx.property.id,
        guest.id,
        code,
        iso(arrive),
        iso(depart <= arrive ? arrive + 1 : depart),
        adults,
        children,
        roomType.id,
        room?.id || null,
        source,
        status,
        payment,
        notes,
        request,
      ],
    );
    updated += 1;
  }
  ctx.summary.reservations = updated;
}

module.exports = { run };
