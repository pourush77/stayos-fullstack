-- LOCAL/DEV ONLY: hard-delete Playwright/E2E inventory pollution.
--
-- This script permanently deletes E2E-created GL/GE rooms, matching E2E room
-- types, and records that exist only because of those fixtures.
--
-- Safety:
-- - Refuses to run unless current_database() looks local/dev/test.
-- - Refuses to run if any matched E2E room type owns a non-GL/GE room.
-- - Refuses to run if deleting matched GL/GE rooms would leave anything other
--   than the expected 24 genuine rooms.
--
-- Run manually against local/dev only:
--   psql -h localhost -p 5432 -U stayos -d stayos_dev -f scripts/hard-cleanup-e2e-inventory.sql

BEGIN;

DO $$
DECLARE
  db_name text := current_database();
  remaining_room_count integer;
  mixed_inventory_count integer;
BEGIN
  IF db_name !~* '(dev|local|test)' THEN
    RAISE EXCEPTION
      'Refusing hard E2E cleanup on database "%". This script is LOCAL/DEV/TEST only.',
      db_name;
  END IF;

  SELECT count(*)
  INTO remaining_room_count
  FROM rooms
  WHERE room_number NOT LIKE 'GL%'
    AND room_number NOT LIKE 'GE%';

  IF remaining_room_count <> 24 THEN
    RAISE EXCEPTION
      'Refusing hard E2E cleanup: non-E2E room count would be %, expected 24.',
      remaining_room_count;
  END IF;

  WITH e2e_room_types AS (
    SELECT id
    FROM room_types
    WHERE code LIKE 'GDL%'
      OR code LIKE 'GST%'
      OR code LIKE 'GED%'
      OR code LIKE 'GEW%'
      OR name LIKE 'E2E Deluxe %'
      OR name LIKE 'E2E Suite %'
      OR name LIKE 'Deluxe Edge %'
      OR name LIKE 'Suite Edge %'
  )
  SELECT count(*)
  INTO mixed_inventory_count
  FROM rooms
  WHERE room_type_id IN (SELECT id FROM e2e_room_types)
    AND room_number NOT LIKE 'GL%'
    AND room_number NOT LIKE 'GE%';

  IF mixed_inventory_count > 0 THEN
    RAISE EXCEPTION
      'Refusing hard E2E cleanup: % non-GL/GE rooms reference matched E2E room types.',
      mixed_inventory_count;
  END IF;
END $$;

-- Preview: target roots.
WITH
e2e_rooms AS (
  SELECT id
  FROM rooms
  WHERE room_number LIKE 'GL%'
     OR room_number LIKE 'GE%'
),
e2e_room_types AS (
  SELECT id
  FROM room_types
  WHERE code LIKE 'GDL%'
     OR code LIKE 'GST%'
     OR code LIKE 'GED%'
     OR code LIKE 'GEW%'
     OR name LIKE 'E2E Deluxe %'
     OR name LIKE 'E2E Suite %'
     OR name LIKE 'Deluxe Edge %'
     OR name LIKE 'Suite Edge %'
)
SELECT 'PREVIEW e2e_rooms' AS item, count(*) AS rows_to_delete FROM e2e_rooms
UNION ALL
SELECT 'PREVIEW e2e_room_types', count(*) FROM e2e_room_types
UNION ALL
SELECT 'PREVIEW final_room_count', count(*) FROM rooms WHERE id NOT IN (SELECT id FROM e2e_rooms)
ORDER BY item;

-- Preview: dependent rows.
WITH
e2e_rooms AS (
  SELECT id
  FROM rooms
  WHERE room_number LIKE 'GL%'
     OR room_number LIKE 'GE%'
),
e2e_room_types AS (
  SELECT id
  FROM room_types
  WHERE code LIKE 'GDL%'
     OR code LIKE 'GST%'
     OR code LIKE 'GED%'
     OR code LIKE 'GEW%'
     OR name LIKE 'E2E Deluxe %'
     OR name LIKE 'E2E Suite %'
     OR name LIKE 'Deluxe Edge %'
     OR name LIKE 'Suite Edge %'
),
e2e_reservations AS (
  SELECT id
  FROM reservations
  WHERE room_id IN (SELECT id FROM e2e_rooms)
     OR room_type_id IN (SELECT id FROM e2e_room_types)
),
e2e_folios AS (
  SELECT id
  FROM folios
  WHERE reservation_id IN (SELECT id FROM e2e_reservations)
),
e2e_guest_requests AS (
  SELECT id
  FROM guest_requests
  WHERE room_id IN (SELECT id FROM e2e_rooms)
     OR reservation_id IN (SELECT id FROM e2e_reservations)
),
e2e_groups AS (
  SELECT DISTINCT group_booking_id AS id
  FROM group_booking_room_assignments
  WHERE room_id IN (SELECT id FROM e2e_rooms)
  UNION
  SELECT DISTINCT group_booking_id
  FROM group_booking_room_blocks
  WHERE room_type_id IN (SELECT id FROM e2e_room_types)
),
e2e_group_stays AS (
  SELECT id
  FROM group_stays
  WHERE group_booking_id IN (SELECT id FROM e2e_groups)
),
e2e_group_master_folios AS (
  SELECT id
  FROM group_master_folios
  WHERE group_booking_id IN (SELECT id FROM e2e_groups)
     OR group_stay_id IN (SELECT id FROM e2e_group_stays)
)
SELECT 'PREVIEW folio_charges' AS item, count(*) AS rows_to_delete
FROM folio_charges
WHERE folio_id IN (SELECT id FROM e2e_folios)
UNION ALL
SELECT 'PREVIEW folio_payments', count(*)
FROM folio_payments
WHERE folio_id IN (SELECT id FROM e2e_folios)
   OR group_master_folio_id IN (SELECT id FROM e2e_group_master_folios)
UNION ALL
SELECT 'PREVIEW folios', count(*) FROM e2e_folios
UNION ALL
SELECT 'PREVIEW guest_documents', count(*)
FROM guest_documents
WHERE reservation_id IN (SELECT id FROM e2e_reservations)
UNION ALL
SELECT 'PREVIEW guest_identity_documents', count(*)
FROM guest_identity_documents
WHERE reservation_id IN (SELECT id FROM e2e_reservations)
UNION ALL
SELECT 'PREVIEW mobile_capture_sessions', count(*)
FROM mobile_capture_sessions
WHERE reservation_id IN (SELECT id FROM e2e_reservations)
UNION ALL
SELECT 'PREVIEW guest_request_notes', count(*)
FROM guest_request_notes
WHERE request_id IN (SELECT id FROM e2e_guest_requests)
UNION ALL
SELECT 'PREVIEW guest_requests', count(*) FROM e2e_guest_requests
UNION ALL
SELECT 'PREVIEW maintenance_tickets', count(*)
FROM maintenance_tickets
WHERE room_id IN (SELECT id FROM e2e_rooms)
UNION ALL
SELECT 'PREVIEW reservations', count(*) FROM e2e_reservations
UNION ALL
SELECT 'PREVIEW group_booking_rooming_list', count(*)
FROM group_booking_rooming_list
WHERE assigned_room_id IN (SELECT id FROM e2e_rooms)
   OR group_booking_id IN (SELECT id FROM e2e_groups)
UNION ALL
SELECT 'PREVIEW group_booking_room_assignments', count(*)
FROM group_booking_room_assignments
WHERE room_id IN (SELECT id FROM e2e_rooms)
   OR group_booking_id IN (SELECT id FROM e2e_groups)
UNION ALL
SELECT 'PREVIEW group_booking_room_blocks', count(*)
FROM group_booking_room_blocks
WHERE room_type_id IN (SELECT id FROM e2e_room_types)
   OR group_booking_id IN (SELECT id FROM e2e_groups)
UNION ALL
SELECT 'PREVIEW group_master_folios', count(*) FROM e2e_group_master_folios
UNION ALL
SELECT 'PREVIEW group_stays', count(*) FROM e2e_group_stays
UNION ALL
SELECT 'PREVIEW group_bookings', count(*) FROM e2e_groups
UNION ALL
SELECT 'PREVIEW room_type_daily_rates', count(*)
FROM room_type_daily_rates
WHERE room_type_id IN (SELECT id FROM e2e_room_types)
UNION ALL
SELECT 'PREVIEW room_type_amenities', count(*)
FROM room_type_amenities
WHERE room_type_id IN (SELECT id FROM e2e_room_types)
ORDER BY item;

-- Keep target sets stable for the delete phase.
CREATE TEMP TABLE cleanup_e2e_rooms ON COMMIT DROP AS
SELECT id
FROM rooms
WHERE room_number LIKE 'GL%'
   OR room_number LIKE 'GE%';

CREATE TEMP TABLE cleanup_e2e_room_types ON COMMIT DROP AS
SELECT id
FROM room_types
WHERE code LIKE 'GDL%'
   OR code LIKE 'GST%'
   OR code LIKE 'GED%'
   OR code LIKE 'GEW%'
   OR name LIKE 'E2E Deluxe %'
   OR name LIKE 'E2E Suite %'
   OR name LIKE 'Deluxe Edge %'
   OR name LIKE 'Suite Edge %';

CREATE TEMP TABLE cleanup_e2e_reservations ON COMMIT DROP AS
SELECT id
FROM reservations
WHERE room_id IN (SELECT id FROM cleanup_e2e_rooms)
   OR room_type_id IN (SELECT id FROM cleanup_e2e_room_types);

CREATE TEMP TABLE cleanup_e2e_folios ON COMMIT DROP AS
SELECT id
FROM folios
WHERE reservation_id IN (SELECT id FROM cleanup_e2e_reservations);

CREATE TEMP TABLE cleanup_e2e_guest_requests ON COMMIT DROP AS
SELECT id
FROM guest_requests
WHERE room_id IN (SELECT id FROM cleanup_e2e_rooms)
   OR reservation_id IN (SELECT id FROM cleanup_e2e_reservations);

CREATE TEMP TABLE cleanup_e2e_groups ON COMMIT DROP AS
SELECT DISTINCT group_booking_id AS id
FROM group_booking_room_assignments
WHERE room_id IN (SELECT id FROM cleanup_e2e_rooms)
UNION
SELECT DISTINCT group_booking_id
FROM group_booking_room_blocks
WHERE room_type_id IN (SELECT id FROM cleanup_e2e_room_types);

CREATE TEMP TABLE cleanup_e2e_group_stays ON COMMIT DROP AS
SELECT id
FROM group_stays
WHERE group_booking_id IN (SELECT id FROM cleanup_e2e_groups);

CREATE TEMP TABLE cleanup_e2e_group_master_folios ON COMMIT DROP AS
SELECT id
FROM group_master_folios
WHERE group_booking_id IN (SELECT id FROM cleanup_e2e_groups)
   OR group_stay_id IN (SELECT id FROM cleanup_e2e_group_stays);

-- Delete reservation dependents.
DELETE FROM folio_charges
WHERE folio_id IN (SELECT id FROM cleanup_e2e_folios);

DELETE FROM folio_payments
WHERE folio_id IN (SELECT id FROM cleanup_e2e_folios)
   OR group_master_folio_id IN (SELECT id FROM cleanup_e2e_group_master_folios);

DELETE FROM folios
WHERE id IN (SELECT id FROM cleanup_e2e_folios);

DELETE FROM guest_documents
WHERE reservation_id IN (SELECT id FROM cleanup_e2e_reservations);

DELETE FROM guest_identity_documents
WHERE reservation_id IN (SELECT id FROM cleanup_e2e_reservations);

DELETE FROM mobile_capture_sessions
WHERE reservation_id IN (SELECT id FROM cleanup_e2e_reservations);

DELETE FROM guest_request_notes
WHERE request_id IN (SELECT id FROM cleanup_e2e_guest_requests);

DELETE FROM guest_requests
WHERE id IN (SELECT id FROM cleanup_e2e_guest_requests);

DELETE FROM reservations
WHERE id IN (SELECT id FROM cleanup_e2e_reservations);

-- Delete group dependents.
DELETE FROM group_booking_rooming_list
WHERE assigned_room_id IN (SELECT id FROM cleanup_e2e_rooms)
   OR group_booking_id IN (SELECT id FROM cleanup_e2e_groups);

DELETE FROM group_booking_room_assignments
WHERE room_id IN (SELECT id FROM cleanup_e2e_rooms)
   OR group_booking_id IN (SELECT id FROM cleanup_e2e_groups);

DELETE FROM group_booking_room_blocks
WHERE room_type_id IN (SELECT id FROM cleanup_e2e_room_types)
   OR group_booking_id IN (SELECT id FROM cleanup_e2e_groups);

DELETE FROM group_master_folios
WHERE id IN (SELECT id FROM cleanup_e2e_group_master_folios);

DELETE FROM group_stays
WHERE id IN (SELECT id FROM cleanup_e2e_group_stays);

DELETE FROM group_bookings
WHERE id IN (SELECT id FROM cleanup_e2e_groups);

-- Delete room and room-type dependents.
DELETE FROM maintenance_tickets
WHERE room_id IN (SELECT id FROM cleanup_e2e_rooms);

DELETE FROM room_type_daily_rates
WHERE room_type_id IN (SELECT id FROM cleanup_e2e_room_types);

DELETE FROM room_type_amenities
WHERE room_type_id IN (SELECT id FROM cleanup_e2e_room_types);

DELETE FROM rooms
WHERE id IN (SELECT id FROM cleanup_e2e_rooms);

DELETE FROM room_types
WHERE id IN (SELECT id FROM cleanup_e2e_room_types);

-- Post-cleanup verification. These queries should return:
--   rooms_total = 24
--   e2e_rooms_remaining = 0
--   e2e_room_types_remaining = 0
--   non_e2e_rooms_remaining = 24
SELECT 'VERIFY rooms_total' AS item, count(*) AS count FROM rooms
UNION ALL
SELECT 'VERIFY e2e_rooms_remaining', count(*)
FROM rooms
WHERE room_number LIKE 'GL%'
   OR room_number LIKE 'GE%'
UNION ALL
SELECT 'VERIFY e2e_room_types_remaining', count(*)
FROM room_types
WHERE code LIKE 'GDL%'
   OR code LIKE 'GST%'
   OR code LIKE 'GED%'
   OR code LIKE 'GEW%'
   OR name LIKE 'E2E Deluxe %'
   OR name LIKE 'E2E Suite %'
   OR name LIKE 'Deluxe Edge %'
   OR name LIKE 'Suite Edge %'
UNION ALL
SELECT 'VERIFY non_e2e_rooms_remaining', count(*)
FROM rooms
WHERE room_number NOT LIKE 'GL%'
  AND room_number NOT LIKE 'GE%'
ORDER BY item;

DO $$
DECLARE
  rooms_total integer;
  e2e_rooms_remaining integer;
  e2e_room_types_remaining integer;
BEGIN
  SELECT count(*) INTO rooms_total FROM rooms;

  SELECT count(*)
  INTO e2e_rooms_remaining
  FROM rooms
  WHERE room_number LIKE 'GL%'
     OR room_number LIKE 'GE%';

  SELECT count(*)
  INTO e2e_room_types_remaining
  FROM room_types
  WHERE code LIKE 'GDL%'
     OR code LIKE 'GST%'
     OR code LIKE 'GED%'
     OR code LIKE 'GEW%'
     OR name LIKE 'E2E Deluxe %'
     OR name LIKE 'E2E Suite %'
     OR name LIKE 'Deluxe Edge %'
     OR name LIKE 'Suite Edge %';

  IF rooms_total <> 24 THEN
    RAISE EXCEPTION 'Post-cleanup assertion failed: rooms count is %, expected 24.', rooms_total;
  END IF;

  IF e2e_rooms_remaining <> 0 THEN
    RAISE EXCEPTION 'Post-cleanup assertion failed: % GL/GE rooms remain.', e2e_rooms_remaining;
  END IF;

  IF e2e_room_types_remaining <> 0 THEN
    RAISE EXCEPTION
      'Post-cleanup assertion failed: % generated E2E room types remain.',
      e2e_room_types_remaining;
  END IF;
END $$;

COMMIT;
