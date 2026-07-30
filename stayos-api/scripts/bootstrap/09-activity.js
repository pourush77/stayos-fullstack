const { one } = require('./00-utils');

const events = [
  ['BOOKING_CREATED', 'Booking created', 'Demo booking created for today arrival', 'reservation'],
  ['ROOM_ASSIGNED', 'Room assigned', 'Room 201 assigned to arrival reservation', 'room'],
  ['GUEST_CHECKED_IN', 'Guest checked in', 'Guest checked in to room 303', 'room'],
  ['GUEST_CHECKED_OUT', 'Guest checked out', 'Guest checked out and room requires cleaning', 'room'],
  ['ROOM_NEEDS_CLEANING', 'Room needs cleaning', 'Room 203 moved to needs cleaning', 'room'],
  ['STAFF_ASSIGNED', 'Staff assigned to room', 'Kaju Devi assigned to room 204', 'room'],
  ['CLEANING_STARTED', 'Cleaning started', 'Ram Kumar started cleaning room 208', 'room'],
  ['CLEANING_COMPLETED', 'Cleaning completed', 'Checklist completed for room 206', 'room'],
  ['ROOM_SENT_FOR_INSPECTION', 'Room sent for inspection', 'Room 206 sent for inspection', 'room'],
  ['ROOM_MARKED_READY', 'Room marked ready', 'Room 205 marked ready', 'room'],
  ['MAINTENANCE_REPORTED', 'Maintenance reported', 'Room 311 marked for maintenance', 'room'],
  ['BOOKING_CANCELLED', 'Booking cancelled', 'Demo cancelled booking recorded', 'reservation'],
];

async function run(client, ctx) {
  const room = await one(client, 'SELECT id FROM rooms WHERE property_id = $1 AND room_number = $2', [
    ctx.property.id,
    '203',
  ]);
  const reservation = await one(
    client,
    "SELECT id FROM reservations WHERE property_id = $1 AND notes LIKE '%[DEMO:RSV-013]%'",
    [ctx.property.id],
  );

  for (const [type, title, description, entityType] of events) {
    const entityId = entityType === 'reservation' ? reservation.id : room.id;
    await client.query(
      `
        DELETE FROM activity_events
        WHERE property_id = $1 AND type = $2 AND metadata->>'seed' = 'demo-bootstrap'
      `,
      [ctx.property.id, type],
    );
    await client.query(
      `
        INSERT INTO activity_events (
          property_id, type, title, description, entity_type, entity_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        ctx.property.id,
        type,
        title,
        description,
        entityType,
        entityId,
        JSON.stringify({ seed: 'demo-bootstrap' }),
      ],
    );
  }
  ctx.summary.activity = events.length;
}

module.exports = { run };
