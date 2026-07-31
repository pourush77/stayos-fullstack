const { mapBy } = require('./00-utils');

const floors = [
  ['SECOND', 'Second Floor', 2, 1],
  ['THIRD', 'Third Floor', 3, 2],
];

const roomTypes = [
  ['DLX', 'Deluxe', 'King bed Deluxe room for two adults and one child.', 2, 3, 2, 1, 'King', 251],
  ['STE', 'Suite', 'Suite for two adults and two children.', 2, 4, 2, 2, 'King', 523],
];

const statusByRoom = {
  READY: ['201', '202', '205', '210', '211', '212', '301', '302', '304', '305', '307', '308', '309', '310'],
  NEEDS_CLEANING: ['203', '204', '207', '208', '209'],
  INSPECTION: ['206'],
  OCCUPIED: ['303', '306'],
  MAINTENANCE: ['311'],
  OUT_OF_SERVICE: ['312'],
};

const roomStatus = (roomNumber) =>
  Object.entries(statusByRoom).find(([, rooms]) => rooms.includes(roomNumber))?.[0] || 'READY';

const suiteRooms = new Set(['212', '303', '309', '310', '312']);
const rooms = [
  ...Array.from({ length: 12 }, (_, index) => String(201 + index)),
  ...Array.from({ length: 12 }, (_, index) => String(301 + index)),
];

async function run(client, ctx) {
  for (const [code, name, number, order] of floors) {
    await client.query(
      `
        INSERT INTO floors (property_id, code, name, floor_number, display_order, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        ON CONFLICT (property_id, code) DO UPDATE SET
          name = EXCLUDED.name,
          floor_number = EXCLUDED.floor_number,
          display_order = EXCLUDED.display_order,
          status = 'ACTIVE',
          updated_at = now()
      `,
      [ctx.property.id, code, name, number, order],
    );
  }

  for (const roomType of roomTypes) {
    await client.query(
      `
        INSERT INTO room_types (
          property_id, code, name, description, base_occupancy, max_occupancy,
          max_adults, max_children, bed_type, size_sq_ft, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
        ON CONFLICT (property_id, code) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          base_occupancy = EXCLUDED.base_occupancy,
          max_occupancy = EXCLUDED.max_occupancy,
          max_adults = EXCLUDED.max_adults,
          max_children = EXCLUDED.max_children,
          bed_type = EXCLUDED.bed_type,
          size_sq_ft = EXCLUDED.size_sq_ft,
          status = 'ACTIVE',
          updated_at = now()
      `,
      [ctx.property.id, ...roomType],
    );
  }

  const floorByCode = await mapBy(
    client,
    'SELECT * FROM floors WHERE property_id = $1',
    [ctx.property.id],
    'code',
  );
  const typeByCode = await mapBy(
    client,
    'SELECT * FROM room_types WHERE property_id = $1',
    [ctx.property.id],
    'code',
  );

  await client.query(
    `
      DELETE FROM rooms room
      WHERE room.property_id = $1
        AND NOT (room.room_number = ANY($2))
        AND NOT EXISTS (
          SELECT 1 FROM reservations reservation WHERE reservation.room_id = room.id
        )
    `,
    [ctx.property.id, rooms],
  );

  for (const roomNumber of rooms) {
    const floorCode = roomNumber.startsWith('2') ? 'SECOND' : 'THIRD';
    const typeCode = suiteRooms.has(roomNumber) ? 'STE' : 'DLX';
    await client.query(
      `
        INSERT INTO rooms (
          property_id, floor_id, room_type_id, room_number, display_name, status,
          operational_status, operational_status_reason, operational_status_note
        )
        VALUES ($1, $2, $3, $4, $4, 'ACTIVE', $5, NULL, $6)
        ON CONFLICT (property_id, room_number) DO UPDATE SET
          floor_id = EXCLUDED.floor_id,
          room_type_id = EXCLUDED.room_type_id,
          display_name = EXCLUDED.display_name,
          status = 'ACTIVE',
          operational_status = EXCLUDED.operational_status,
          operational_status_reason = EXCLUDED.operational_status_reason,
          operational_status_note = EXCLUDED.operational_status_note,
          updated_at = now()
      `,
      [
        ctx.property.id,
        floorByCode.get(floorCode).id,
        typeByCode.get(typeCode).id,
        roomNumber,
        roomStatus(roomNumber),
        `Demo room status: ${roomStatus(roomNumber)}`,
      ],
    );
  }

  ctx.rooms = await mapBy(client, 'SELECT * FROM rooms WHERE property_id = $1', [ctx.property.id], 'room_number');
  ctx.roomTypes = typeByCode;
  ctx.summary.rooms = rooms.length;
}

module.exports = { run, statusByRoom };
