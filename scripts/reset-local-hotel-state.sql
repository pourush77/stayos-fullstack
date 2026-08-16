-- LOCAL/DEV ONLY: reset operational hotel state while preserving configuration.
--
-- This script removes booking/stay/runtime data from a local StayOS database and
-- returns the genuine 24-room hotel inventory to ACTIVE/READY.
--
-- Preserved:
-- - properties, floors
-- - users, user_sessions, employees
-- - room_types, rooms
-- - amenities, room_type_amenities
-- - rate_plans, room_type_daily_rates
-- - property_tax_configs, guest_pricing_policies, child_age_bands
-- - migrations
--
-- Deleted/reset:
-- - reservations and check-in/capture documents
-- - individual and group folios/payments/charges
-- - group bookings, blocks, assignments, rooming lists, stays, master folios
-- - guest requests/notes, guests
-- - maintenance tickets
-- - local activity/audit event logs
-- - room runtime housekeeping/occupancy fields
--
-- Run manually against local/dev only:
--   psql -h localhost -p 5432 -U stayos -d stayos_dev -v ON_ERROR_STOP=1 -f scripts/reset-local-hotel-state.sql

BEGIN;

DO $$
DECLARE
  db_name text := current_database();
  genuine_room_count integer;
  generated_room_count integer;
  generated_room_type_count integer;
BEGIN
  IF db_name !~* '(dev|local|test)' THEN
    RAISE EXCEPTION
      'Refusing local hotel reset on database "%". This script is LOCAL/DEV/TEST only.',
      db_name;
  END IF;

  SELECT count(*)
  INTO generated_room_count
  FROM rooms
  WHERE room_number LIKE 'GL%'
     OR room_number LIKE 'GE%';

  IF generated_room_count <> 0 THEN
    RAISE EXCEPTION
      'Refusing local hotel reset: % generated GL/GE rooms remain. Run hard-cleanup-e2e-inventory.sql first.',
      generated_room_count;
  END IF;

  SELECT count(*)
  INTO generated_room_type_count
  FROM room_types
  WHERE code LIKE 'GDL%'
     OR code LIKE 'GST%'
     OR code LIKE 'GED%'
     OR code LIKE 'GEW%'
     OR name LIKE 'E2E Deluxe %'
     OR name LIKE 'E2E Suite %'
     OR name LIKE 'Deluxe Edge %'
     OR name LIKE 'Suite Edge %';

  IF generated_room_type_count <> 0 THEN
    RAISE EXCEPTION
      'Refusing local hotel reset: % generated E2E room types remain. Run hard-cleanup-e2e-inventory.sql first.',
      generated_room_type_count;
  END IF;

  SELECT count(*)
  INTO genuine_room_count
  FROM rooms;

  IF genuine_room_count <> 24 THEN
    RAISE EXCEPTION
      'Refusing local hotel reset: room count is %, expected the genuine 24-room hotel.',
      genuine_room_count;
  END IF;
END $$;

-- Preview rows that will be cleared.
SELECT 'PREVIEW activity_events' AS item, count(*) AS rows_to_delete FROM activity_events
UNION ALL SELECT 'PREVIEW audit_events', count(*) FROM audit_events
UNION ALL SELECT 'PREVIEW folio_charges', count(*) FROM folio_charges
UNION ALL SELECT 'PREVIEW folio_payments', count(*) FROM folio_payments
UNION ALL SELECT 'PREVIEW folios', count(*) FROM folios
UNION ALL SELECT 'PREVIEW group_booking_room_assignments', count(*) FROM group_booking_room_assignments
UNION ALL SELECT 'PREVIEW group_booking_room_blocks', count(*) FROM group_booking_room_blocks
UNION ALL SELECT 'PREVIEW group_booking_rooming_list', count(*) FROM group_booking_rooming_list
UNION ALL SELECT 'PREVIEW group_bookings', count(*) FROM group_bookings
UNION ALL SELECT 'PREVIEW group_master_folios', count(*) FROM group_master_folios
UNION ALL SELECT 'PREVIEW group_stays', count(*) FROM group_stays
UNION ALL SELECT 'PREVIEW guest_documents', count(*) FROM guest_documents
UNION ALL SELECT 'PREVIEW guest_identity_documents', count(*) FROM guest_identity_documents
UNION ALL SELECT 'PREVIEW guest_request_notes', count(*) FROM guest_request_notes
UNION ALL SELECT 'PREVIEW guest_requests', count(*) FROM guest_requests
UNION ALL SELECT 'PREVIEW guests', count(*) FROM guests
UNION ALL SELECT 'PREVIEW maintenance_tickets', count(*) FROM maintenance_tickets
UNION ALL SELECT 'PREVIEW mobile_capture_sessions', count(*) FROM mobile_capture_sessions
UNION ALL SELECT 'PREVIEW reservations', count(*) FROM reservations
ORDER BY item;

-- Preview preserved configuration.
SELECT 'PRESERVE properties' AS item, count(*) AS rows_preserved FROM properties
UNION ALL SELECT 'PRESERVE floors', count(*) FROM floors
UNION ALL SELECT 'PRESERVE room_types', count(*) FROM room_types
UNION ALL SELECT 'PRESERVE rooms', count(*) FROM rooms
UNION ALL SELECT 'PRESERVE users', count(*) FROM users
UNION ALL SELECT 'PRESERVE user_sessions', count(*) FROM user_sessions
UNION ALL SELECT 'PRESERVE employees', count(*) FROM employees
UNION ALL SELECT 'PRESERVE amenities', count(*) FROM amenities
UNION ALL SELECT 'PRESERVE room_type_amenities', count(*) FROM room_type_amenities
UNION ALL SELECT 'PRESERVE rate_plans', count(*) FROM rate_plans
UNION ALL SELECT 'PRESERVE room_type_daily_rates', count(*) FROM room_type_daily_rates
UNION ALL SELECT 'PRESERVE property_tax_configs', count(*) FROM property_tax_configs
UNION ALL SELECT 'PRESERVE guest_pricing_policies', count(*) FROM guest_pricing_policies
UNION ALL SELECT 'PRESERVE child_age_bands', count(*) FROM child_age_bands
ORDER BY item;

CREATE TEMP TABLE reset_deleted_counts (
  table_name text PRIMARY KEY,
  rows_deleted integer NOT NULL
) ON COMMIT DROP;

-- Runtime logs first: they only reference property and may contain stale entity ids in JSON/text fields.
WITH deleted AS (DELETE FROM activity_events RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'activity_events', count(*) FROM deleted;

WITH deleted AS (DELETE FROM audit_events RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'audit_events', count(*) FROM deleted;

-- Individual folio dependents before folios.
WITH deleted AS (DELETE FROM folio_charges RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'folio_charges', count(*) FROM deleted;

-- Covers both individual folio payments and group master folio payments.
WITH deleted AS (DELETE FROM folio_payments RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'folio_payments', count(*) FROM deleted;

WITH deleted AS (DELETE FROM folios RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'folios', count(*) FROM deleted;

-- Reservation/check-in dependents before reservations and guests.
WITH deleted AS (DELETE FROM guest_documents RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'guest_documents', count(*) FROM deleted;

WITH deleted AS (DELETE FROM guest_identity_documents RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'guest_identity_documents', count(*) FROM deleted;

WITH deleted AS (DELETE FROM mobile_capture_sessions RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'mobile_capture_sessions', count(*) FROM deleted;

-- Guest-request notes before guest requests.
WITH deleted AS (DELETE FROM guest_request_notes RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'guest_request_notes', count(*) FROM deleted;

WITH deleted AS (DELETE FROM guest_requests RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'guest_requests', count(*) FROM deleted;

-- Group booking dependents before group parent rows.
WITH deleted AS (DELETE FROM group_booking_rooming_list RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'group_booking_rooming_list', count(*) FROM deleted;

WITH deleted AS (DELETE FROM group_booking_room_assignments RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'group_booking_room_assignments', count(*) FROM deleted;

WITH deleted AS (DELETE FROM group_booking_room_blocks RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'group_booking_room_blocks', count(*) FROM deleted;

-- group_master_folios references both group_bookings and group_stays.
WITH deleted AS (DELETE FROM group_master_folios RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'group_master_folios', count(*) FROM deleted;

WITH deleted AS (DELETE FROM group_stays RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'group_stays', count(*) FROM deleted;

WITH deleted AS (DELETE FROM group_bookings RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'group_bookings', count(*) FROM deleted;

-- Maintenance and reservations both reference rooms; reservations also reference guests.
WITH deleted AS (DELETE FROM maintenance_tickets RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'maintenance_tickets', count(*) FROM deleted;

WITH deleted AS (DELETE FROM reservations RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'reservations', count(*) FROM deleted;

-- Guests are transactional in the local reset; all guest-owned operational rows are gone by now.
WITH deleted AS (DELETE FROM guests RETURNING 1)
INSERT INTO reset_deleted_counts SELECT 'guests', count(*) FROM deleted;

-- Reset all genuine rooms to a fresh operational state.
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
  updated_at = now();

SELECT 'DELETED ' || table_name AS item, rows_deleted AS count
FROM reset_deleted_counts
ORDER BY table_name;

-- Verification queries required by the reset contract.
SELECT COUNT(*) AS rooms_count FROM rooms;

SELECT COUNT(*) AS active_rooms_count
FROM rooms
WHERE status = 'ACTIVE';

SELECT operational_status, COUNT(*)
FROM rooms
GROUP BY operational_status
ORDER BY operational_status;

SELECT COUNT(*) AS reservations_count FROM reservations;

SELECT COUNT(*) AS group_bookings_count FROM group_bookings;

-- Additional verification: no active stays, assignments, E2E inventory, or transactional guests remain.
SELECT 'VERIFY group_assignments' AS item, count(*) AS count FROM group_booking_room_assignments
UNION ALL SELECT 'VERIFY group_stays', count(*) FROM group_stays
UNION ALL SELECT 'VERIFY group_master_folios', count(*) FROM group_master_folios
UNION ALL SELECT 'VERIFY folios', count(*) FROM folios
UNION ALL SELECT 'VERIFY guests', count(*) FROM guests
UNION ALL SELECT 'VERIFY maintenance_tickets', count(*) FROM maintenance_tickets
UNION ALL SELECT 'VERIFY e2e_rooms', count(*) FROM rooms WHERE room_number LIKE 'GL%' OR room_number LIKE 'GE%'
UNION ALL SELECT 'VERIFY e2e_room_types', count(*) FROM room_types
WHERE code LIKE 'GDL%'
   OR code LIKE 'GST%'
   OR code LIKE 'GED%'
   OR code LIKE 'GEW%'
   OR name LIKE 'E2E Deluxe %'
   OR name LIKE 'E2E Suite %'
   OR name LIKE 'Deluxe Edge %'
   OR name LIKE 'Suite Edge %'
ORDER BY item;

-- Hard assertions: any failure aborts the transaction.
DO $$
DECLARE
  rooms_count integer;
  active_rooms_count integer;
  ready_rooms_count integer;
  reservations_count integer;
  group_bookings_count integer;
  group_assignments_count integer;
  group_stays_count integer;
  e2e_rooms_count integer;
  e2e_room_types_count integer;
BEGIN
  SELECT count(*) INTO rooms_count FROM rooms;
  SELECT count(*) INTO active_rooms_count FROM rooms WHERE status = 'ACTIVE';
  SELECT count(*) INTO ready_rooms_count FROM rooms WHERE operational_status = 'READY';
  SELECT count(*) INTO reservations_count FROM reservations;
  SELECT count(*) INTO group_bookings_count FROM group_bookings;
  SELECT count(*) INTO group_assignments_count FROM group_booking_room_assignments;
  SELECT count(*) INTO group_stays_count FROM group_stays;

  SELECT count(*)
  INTO e2e_rooms_count
  FROM rooms
  WHERE room_number LIKE 'GL%'
     OR room_number LIKE 'GE%';

  SELECT count(*)
  INTO e2e_room_types_count
  FROM room_types
  WHERE code LIKE 'GDL%'
     OR code LIKE 'GST%'
     OR code LIKE 'GED%'
     OR code LIKE 'GEW%'
     OR name LIKE 'E2E Deluxe %'
     OR name LIKE 'E2E Suite %'
     OR name LIKE 'Deluxe Edge %'
     OR name LIKE 'Suite Edge %';

  IF rooms_count <> 24 THEN
    RAISE EXCEPTION 'Post-reset assertion failed: rooms count is %, expected 24.', rooms_count;
  END IF;

  IF active_rooms_count <> 24 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: active rooms count is %, expected 24.',
      active_rooms_count;
  END IF;

  IF ready_rooms_count <> 24 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: READY rooms count is %, expected 24.',
      ready_rooms_count;
  END IF;

  IF reservations_count <> 0 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: reservations count is %, expected 0.',
      reservations_count;
  END IF;

  IF group_bookings_count <> 0 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: group_bookings count is %, expected 0.',
      group_bookings_count;
  END IF;

  IF group_assignments_count <> 0 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: group assignments count is %, expected 0.',
      group_assignments_count;
  END IF;

  IF group_stays_count <> 0 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: group stays count is %, expected 0.',
      group_stays_count;
  END IF;

  IF e2e_rooms_count <> 0 THEN
    RAISE EXCEPTION 'Post-reset assertion failed: E2E rooms count is %, expected 0.', e2e_rooms_count;
  END IF;

  IF e2e_room_types_count <> 0 THEN
    RAISE EXCEPTION
      'Post-reset assertion failed: E2E room types count is %, expected 0.',
      e2e_room_types_count;
  END IF;
END $$;

COMMIT;
