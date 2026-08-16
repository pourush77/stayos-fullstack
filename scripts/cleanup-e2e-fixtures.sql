-- Safe local cleanup for E2E-created inventory pollution.
-- This intentionally soft-disables only rows with E2E naming prefixes used by Playwright specs.
-- Run against a local/dev database only after reviewing the matching rows.

BEGIN;

WITH e2e_room_types AS (
  SELECT id
  FROM room_types
  WHERE
    code LIKE 'GDL%'
    OR code LIKE 'GST%'
    OR code LIKE 'GED%'
    OR code LIKE 'GEW%'
    OR name LIKE 'E2E Deluxe %'
    OR name LIKE 'E2E Suite %'
    OR name LIKE 'Deluxe Edge %'
    OR name LIKE 'Suite Edge %'
)
UPDATE rooms
SET
  status = 'INACTIVE',
  operational_status = CASE
    WHEN operational_status = 'OCCUPIED' THEN operational_status
    ELSE 'OUT_OF_SERVICE'
  END,
  operational_status_reason = 'E2E cleanup',
  operational_status_note = 'Soft-disabled by scripts/cleanup-e2e-fixtures.sql',
  updated_at = now()
WHERE
  room_type_id IN (SELECT id FROM e2e_room_types)
  OR room_number LIKE 'GL%'
  OR room_number LIKE 'GE%';

WITH e2e_room_types AS (
  SELECT id
  FROM room_types
  WHERE
    code LIKE 'GDL%'
    OR code LIKE 'GST%'
    OR code LIKE 'GED%'
    OR code LIKE 'GEW%'
    OR name LIKE 'E2E Deluxe %'
    OR name LIKE 'E2E Suite %'
    OR name LIKE 'Deluxe Edge %'
    OR name LIKE 'Suite Edge %'
)
UPDATE room_types
SET status = 'INACTIVE', updated_at = now()
WHERE id IN (SELECT id FROM e2e_room_types);

COMMIT;
