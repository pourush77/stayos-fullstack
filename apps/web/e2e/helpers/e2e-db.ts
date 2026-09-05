import { execFileSync } from 'node:child_process';

const dbEnv = {
  PGHOST: process.env.DATABASE_HOST ?? 'localhost',
  PGPORT: process.env.DATABASE_PORT ?? '5432',
  PGDATABASE: process.env.DATABASE_NAME ?? 'stayos_dev',
  PGUSER: process.env.DATABASE_USERNAME ?? 'stayos',
  PGPASSWORD: process.env.DATABASE_PASSWORD ?? 'StayOS@2026',
};

export const E2E_PROPERTY_CODE = process.env.E2E_PROPERTY_CODE ?? 'STAYOS_E2E';
export const E2E_ROOM_TYPE_CODES = ['E2E_DLX', 'E2E_STE'] as const;
export const E2E_ROOM_NUMBERS = ['E201', 'E202', 'E203', 'E204', 'E205', 'E206'] as const;

export type E2ECounts = {
  e2eRooms: number;
  e2eRoomTypes: number;
  mainRooms: number;
  mainRoomTypes: string;
};

function runPsql(sql: string) {
  return execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-Atc', sql], {
    encoding: 'utf8',
    env: { ...process.env, ...dbEnv },
  }).trim();
}

export function ensureE2EPropertyFixture() {
  runPsql(`
    DO $$
    DECLARE
      db_name text := current_database();
      e2e_property_id uuid;
      e2e_floor_id uuid;
      dlx_type_id uuid;
      ste_type_id uuid;
      extra_room_count integer;
      extra_type_count integer;
      main_room_count integer;
      main_type_codes text;
    BEGIN
      IF db_name !~* '(dev|local|test)' THEN
        RAISE EXCEPTION 'Refusing E2E fixture setup on database "%".', db_name;
      END IF;

      INSERT INTO properties (
        code, name, legal_name, gst_number, email, phone, address_line_1,
        city, state, state_code, country, postal_code, timezone, currency,
        check_in_time, check_out_time, total_floors, total_rooms, status, current_business_date
      )
      VALUES (
        '${E2E_PROPERTY_CODE}', 'StayOS E2E Hotel', 'StayOS E2E Hotel Pvt. Ltd.',
        '29ABCDE1234F1Z5', 'e2e@stayos.local', '+910000000000',
        'Local E2E Fixture', 'Bengaluru', 'Karnataka', '29', 'India',
        '560001', 'Asia/Kolkata', 'INR', '14:00', '11:00', 1, 6, 'ACTIVE',
        ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        total_floors = 1,
        total_rooms = 6,
        status = 'ACTIVE',
        updated_at = now()
      RETURNING id INTO e2e_property_id;

      INSERT INTO floors (property_id, code, name, floor_number, display_order, status)
      VALUES (e2e_property_id, 'E2E-FLOOR', 'E2E Floor', 2, 1, 'ACTIVE')
      ON CONFLICT (property_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        floor_number = EXCLUDED.floor_number,
        display_order = EXCLUDED.display_order,
        status = 'ACTIVE',
        updated_at = now()
      RETURNING id INTO e2e_floor_id;

      INSERT INTO room_types (
        property_id, code, name, description, base_occupancy, max_occupancy,
        max_adults, max_children, bed_type, size_sq_ft, status
      )
      VALUES (
        e2e_property_id, 'E2E_DLX', 'E2E Deluxe', 'Stable E2E deluxe room type',
        2, 3, 2, 1, 'King', 320, 'ACTIVE'
      )
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
      RETURNING id INTO dlx_type_id;

      INSERT INTO room_types (
        property_id, code, name, description, base_occupancy, max_occupancy,
        max_adults, max_children, bed_type, size_sq_ft, status
      )
      VALUES (
        e2e_property_id, 'E2E_STE', 'E2E Suite', 'Stable E2E suite room type',
        2, 4, 3, 2, 'King', 420, 'ACTIVE'
      )
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
      RETURNING id INTO ste_type_id;

      INSERT INTO rooms (property_id, floor_id, room_type_id, room_number, display_name, status, operational_status)
      VALUES
        (e2e_property_id, e2e_floor_id, dlx_type_id, 'E201', 'E201', 'ACTIVE', 'READY'),
        (e2e_property_id, e2e_floor_id, dlx_type_id, 'E202', 'E202', 'ACTIVE', 'READY'),
        (e2e_property_id, e2e_floor_id, dlx_type_id, 'E203', 'E203', 'ACTIVE', 'READY'),
        (e2e_property_id, e2e_floor_id, dlx_type_id, 'E204', 'E204', 'ACTIVE', 'READY'),
        (e2e_property_id, e2e_floor_id, ste_type_id, 'E205', 'E205', 'ACTIVE', 'READY'),
        (e2e_property_id, e2e_floor_id, ste_type_id, 'E206', 'E206', 'ACTIVE', 'READY')
      ON CONFLICT (property_id, room_number) DO UPDATE SET
        floor_id = EXCLUDED.floor_id,
        room_type_id = EXCLUDED.room_type_id,
        display_name = EXCLUDED.display_name,
        status = 'ACTIVE',
        operational_status = 'READY',
        operational_status_reason = NULL,
        operational_status_note = NULL,
        updated_at = now();

      SELECT count(*) INTO extra_room_count
      FROM rooms
      WHERE property_id = e2e_property_id
        AND room_number NOT IN ('E201', 'E202', 'E203', 'E204', 'E205', 'E206');

      SELECT count(*) INTO extra_type_count
      FROM room_types
      WHERE property_id = e2e_property_id
        AND code NOT IN ('E2E_DLX', 'E2E_STE');

      IF extra_room_count > 0 OR extra_type_count > 0 THEN
        RAISE EXCEPTION
          'STAYOS_E2E contains unapproved inventory: % extra rooms, % extra room types.',
          extra_room_count,
          extra_type_count;
      END IF;

      SELECT count(*) INTO main_room_count
      FROM rooms room
      INNER JOIN properties property ON property.id = room.property_id
      WHERE property.code <> '${E2E_PROPERTY_CODE}';

      SELECT string_agg(room_type.code, ',' ORDER BY room_type.code) INTO main_type_codes
      FROM room_types room_type
      INNER JOIN properties property ON property.id = room_type.property_id
      WHERE property.code <> '${E2E_PROPERTY_CODE}';

      IF main_room_count <> 24 OR main_type_codes <> 'DLX,STE' THEN
        RAISE EXCEPTION
          'Main hotel baseline changed: rooms %, room types %.',
          main_room_count,
          main_type_codes;
      END IF;
    END $$;
  `);
}

export function resetE2ETransactionalData() {
  runPsql(`
    DO $$
    DECLARE
      db_name text := current_database();
      e2e_property_id uuid;
    BEGIN
      IF db_name !~* '(dev|local|test)' THEN
        RAISE EXCEPTION 'Refusing E2E reset on database "%".', db_name;
      END IF;

      SELECT id INTO e2e_property_id FROM properties WHERE code = '${E2E_PROPERTY_CODE}';
      IF e2e_property_id IS NULL THEN
        RAISE EXCEPTION 'Missing % property. Run E2E fixture setup first.', '${E2E_PROPERTY_CODE}';
      END IF;

      DELETE FROM folio_charges WHERE folio_id IN (SELECT id FROM folios WHERE property_id = e2e_property_id);
      DELETE FROM folio_payments
      WHERE folio_id IN (SELECT id FROM folios WHERE property_id = e2e_property_id)
         OR group_master_folio_id IN (SELECT id FROM group_master_folios WHERE group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = e2e_property_id));
      DELETE FROM folios WHERE property_id = e2e_property_id;
      DELETE FROM guest_documents WHERE property_id = e2e_property_id;
      DELETE FROM guest_identity_documents WHERE property_id = e2e_property_id;
      DELETE FROM mobile_capture_sessions WHERE property_id = e2e_property_id;
      DELETE FROM guest_request_notes WHERE property_id = e2e_property_id;
      DELETE FROM guest_requests WHERE property_id = e2e_property_id;
      DELETE FROM group_booking_rooming_list WHERE group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = e2e_property_id);
      DELETE FROM group_booking_room_assignments WHERE group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = e2e_property_id);
      DELETE FROM group_booking_room_blocks WHERE group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = e2e_property_id);
      DELETE FROM group_master_folios WHERE group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = e2e_property_id);
      DELETE FROM group_stays WHERE group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = e2e_property_id);
      DELETE FROM group_bookings WHERE property_id = e2e_property_id;
      DELETE FROM maintenance_tickets WHERE property_id = e2e_property_id;
      DELETE FROM reservations WHERE property_id = e2e_property_id;
      DELETE FROM guests WHERE property_id = e2e_property_id;
      DELETE FROM activity_events WHERE property_id = e2e_property_id;
      DELETE FROM audit_events WHERE property_id = e2e_property_id;

      UPDATE rooms
      SET
        status = 'ACTIVE',
        operational_status = 'READY',
        operational_status_reason = NULL,
        operational_status_note = NULL,
        assigned_employee_id = NULL,
        started_at = NULL,
        completed_at = NULL,
        inspected_at = NULL,
        completed_by_employee_id = NULL,
        completed_by_user_id = NULL,
        inspected_by_user_id = NULL,
        completed_on_behalf = false,
        checklist = '[]'::jsonb,
        rework_reason = NULL,
        updated_at = now()
      WHERE property_id = e2e_property_id;
    END $$;
  `);
}

export function readE2EInventoryCounts(): E2ECounts {
  const output = runPsql(`
    SELECT
      (SELECT count(*) FROM rooms r INNER JOIN properties p ON p.id = r.property_id WHERE p.code = '${E2E_PROPERTY_CODE}') || '|' ||
      (SELECT count(*) FROM room_types rt INNER JOIN properties p ON p.id = rt.property_id WHERE p.code = '${E2E_PROPERTY_CODE}') || '|' ||
      (SELECT count(*) FROM rooms r INNER JOIN properties p ON p.id = r.property_id WHERE p.code <> '${E2E_PROPERTY_CODE}') || '|' ||
      (SELECT string_agg(rt.code, ',' ORDER BY rt.code) FROM room_types rt INNER JOIN properties p ON p.id = rt.property_id WHERE p.code <> '${E2E_PROPERTY_CODE}');
  `);
  const [e2eRooms, e2eRoomTypes, mainRooms, mainRoomTypes] = output.split('|');
  return {
    e2eRooms: Number(e2eRooms),
    e2eRoomTypes: Number(e2eRoomTypes),
    mainRooms: Number(mainRooms),
    mainRoomTypes,
  };
}

export function assertE2EInventoryCounts() {
  const counts = readE2EInventoryCounts();
  if (
    counts.mainRooms !== 24 ||
    counts.mainRoomTypes !== 'DLX,STE' ||
    counts.e2eRooms !== 6 ||
    counts.e2eRoomTypes !== 2
  ) {
    throw new Error(`Unexpected E2E inventory counts: ${JSON.stringify(counts)}`);
  }
  return counts;
}
