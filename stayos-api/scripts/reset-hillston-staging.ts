import 'dotenv/config';
import dataSource from '../src/database/data-source';
import { HILLSTON_PROPERTY_CODE } from './bootstrap-hillston';

const APPLY_FLAG = '--apply';
const CONFIRM_ENV = 'STAGING_RESET_CONFIRM';
const EXPECTED_CONFIRMATION = 'RESET-HILLSTON-STAGING';
const PROPERTY_ENV = 'STAGING_RESET_PROPERTY_CODE';

interface CountRow {
  label: string;
  count: number;
}

function wantsApply(): boolean {
  return process.argv.includes(APPLY_FLAG);
}

function assertExplicitSafety(propertyCode: string): void {
  if (!wantsApply()) return;

  if (process.env[CONFIRM_ENV] !== EXPECTED_CONFIRMATION) {
    throw new Error(
      `Refusing staging reset. Set ${CONFIRM_ENV}=${EXPECTED_CONFIRMATION} and retry.`,
    );
  }

  const confirmedProperty = process.env[PROPERTY_ENV];
  if (confirmedProperty !== propertyCode) {
    throw new Error(
      `Refusing staging reset. Set ${PROPERTY_ENV}=${propertyCode} to explicitly confirm the target property.`,
    );
  }

  const renderService = process.env.RENDER_SERVICE_NAME;
  if (renderService && !renderService.toLowerCase().includes('staging')) {
    throw new Error(
      `Refusing staging reset on Render service "${renderService}" because its name does not contain "staging".`,
    );
  }
}

async function getCount(query: string, params: unknown[]): Promise<number> {
  const rows = (await dataSource.query(query, params)) as Array<{ count: string | number }>;
  return Number(rows[0]?.count ?? 0);
}

async function preview(propertyId: string): Promise<CountRow[]> {
  const counts: CountRow[] = [];
  const add = async (label: string, query: string, params: unknown[] = [propertyId]) => {
    counts.push({ label, count: await getCount(query, params) });
  };

  await add(
    'reservations',
    'SELECT COUNT(*)::int AS count FROM reservations WHERE property_id = $1',
  );
  await add(
    'reservation_rate_snapshots',
    'SELECT COUNT(*)::int AS count FROM reservation_rate_snapshots WHERE property_id = $1',
  );
  await add(
    'room_type_inventory',
    'SELECT COUNT(*)::int AS count FROM room_type_inventory WHERE property_id = $1',
  );
  await add('folios', 'SELECT COUNT(*)::int AS count FROM folios WHERE property_id = $1');
  await add('invoices', 'SELECT COUNT(*)::int AS count FROM invoices WHERE property_id = $1');
  await add(
    'group_bookings',
    'SELECT COUNT(*)::int AS count FROM group_bookings WHERE property_id = $1',
  );
  await add('guests', 'SELECT COUNT(*)::int AS count FROM guests WHERE property_id = $1');
  await add(
    'maintenance_tickets',
    'SELECT COUNT(*)::int AS count FROM maintenance_tickets WHERE property_id = $1',
  );
  await add(
    'activity_events',
    'SELECT COUNT(*)::int AS count FROM activity_events WHERE property_id = $1',
  );
  await add(
    'audit_events',
    'SELECT COUNT(*)::int AS count FROM audit_events WHERE property_id = $1',
  );
  await add(
    'rate_restrictions',
    'SELECT COUNT(*)::int AS count FROM rate_restrictions WHERE property_id = $1',
  );
  await add(
    'rooms_not_ready',
    `SELECT COUNT(*)::int AS count FROM rooms WHERE property_id = $1 AND (status <> 'ACTIVE' OR operational_status <> 'READY')`,
  );

  return counts;
}

async function deleteAndCount(
  managerQuery: (query: string, parameters?: unknown[]) => Promise<unknown>,
  table: string,
  whereSql: string,
  params: unknown[],
): Promise<number> {
  const result = (await managerQuery(
    `WITH deleted AS (DELETE FROM ${table} WHERE ${whereSql} RETURNING 1) SELECT COUNT(*)::int AS count FROM deleted`,
    params,
  )) as Array<{ count: number | string }>;
  return Number(result[0]?.count ?? 0);
}

async function applyReset(propertyId: string): Promise<Map<string, number>> {
  return dataSource.transaction(async (manager) => {
    const deleted = new Map<string, number>();
    const runDelete = async (table: string, whereSql: string, params: unknown[] = [propertyId]) => {
      const count = await deleteAndCount(
        (query, parameters) => manager.query(query, parameters),
        table,
        whereSql,
        params,
      );
      deleted.set(table, count);
    };

    // Property-scoped runtime/audit data first. Staging reset intentionally clears
    // operational history; this command is never intended for production.
    await runDelete('activity_events', 'property_id = $1');
    await runDelete('audit_events', 'property_id = $1');

    // Billing/invoice dependents before folios/reservations/guests.
    await runDelete('invoices', 'property_id = $1');
    await runDelete(
      'folio_payments',
      `folio_id IN (SELECT id FROM folios WHERE property_id = $1)
       OR group_master_folio_id IN (SELECT id FROM group_master_folios WHERE property_id = $1)`,
    );
    await runDelete('folio_charges', 'folio_id IN (SELECT id FROM folios WHERE property_id = $1)');
    await runDelete('folios', 'property_id = $1');

    // Check-in/capture/service rows tied to the property.
    await runDelete('guest_documents', 'property_id = $1');
    await runDelete('guest_identity_documents', 'property_id = $1');
    await runDelete('mobile_capture_sessions', 'property_id = $1');
    await runDelete('guest_request_notes', 'property_id = $1');
    await runDelete('guest_requests', 'property_id = $1');

    // Group operational data. Child tables do not all carry property_id, so
    // delete them through their group_booking relation.
    await runDelete(
      'group_booking_rooming_list',
      'group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = $1)',
    );
    await runDelete(
      'group_booking_room_assignments',
      'group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = $1)',
    );
    await runDelete(
      'group_booking_room_blocks',
      'group_booking_id IN (SELECT id FROM group_bookings WHERE property_id = $1)',
    );
    await runDelete('group_master_folios', 'property_id = $1');
    await runDelete('group_stays', 'property_id = $1');
    await runDelete('group_bookings', 'property_id = $1');

    // Reservation commercial/inventory runtime state.
    await runDelete('reservation_rate_snapshots', 'property_id = $1');
    await runDelete('room_type_inventory', 'property_id = $1');
    await runDelete('maintenance_tickets', 'property_id = $1');
    await runDelete('reservations', 'property_id = $1');
    await runDelete('guests', 'property_id = $1');

    // Restrictions are date-driven runtime selling controls. Clearing them gives
    // staging a neutral booking baseline while preserving rate plans/policies/tax rules.
    await runDelete('rate_restrictions', 'property_id = $1');

    // Numbering counters can restart safely because all staging transactional
    // documents for this property have just been removed.
    await runDelete('reservation_code_counters', 'property_id = $1');
    await runDelete('folio_number_counters', 'property_id = $1');
    await runDelete('invoice_number_counters', 'property_id = $1');

    // Restore all physical rooms to a clean operational baseline.
    await manager.query(
      `UPDATE rooms
       SET status = 'ACTIVE',
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
       WHERE property_id = $1`,
      [propertyId],
    );

    // Transactional hard assertions. Any failure rolls the reset back.
    const assertZero = async (label: string, query: string) => {
      const rows = (await manager.query(query, [propertyId])) as Array<{ count: string | number }>;
      const count = Number(rows[0]?.count ?? 0);
      if (count !== 0)
        throw new Error(`Post-reset assertion failed: ${label}=${count}, expected 0.`);
    };

    await assertZero(
      'reservations',
      'SELECT COUNT(*)::int AS count FROM reservations WHERE property_id = $1',
    );
    await assertZero('folios', 'SELECT COUNT(*)::int AS count FROM folios WHERE property_id = $1');
    await assertZero(
      'invoices',
      'SELECT COUNT(*)::int AS count FROM invoices WHERE property_id = $1',
    );
    await assertZero(
      'room_type_inventory',
      'SELECT COUNT(*)::int AS count FROM room_type_inventory WHERE property_id = $1',
    );
    await assertZero(
      'group_bookings',
      'SELECT COUNT(*)::int AS count FROM group_bookings WHERE property_id = $1',
    );
    await assertZero(
      'maintenance_tickets',
      'SELECT COUNT(*)::int AS count FROM maintenance_tickets WHERE property_id = $1',
    );
    await assertZero(
      'rate_restrictions',
      'SELECT COUNT(*)::int AS count FROM rate_restrictions WHERE property_id = $1',
    );
    await assertZero(
      'rooms_not_ready',
      `SELECT COUNT(*)::int AS count FROM rooms
       WHERE property_id = $1 AND (status <> 'ACTIVE' OR operational_status <> 'READY')`,
    );

    return deleted;
  });
}

async function run(): Promise<void> {
  const propertyCode = HILLSTON_PROPERTY_CODE;
  assertExplicitSafety(propertyCode);

  await dataSource.initialize();
  try {
    const dbInfo = (await dataSource.query(
      'SELECT current_database() AS database, current_user AS db_user',
    )) as Array<{ database: string; db_user: string }>;
    const propertyRows = (await dataSource.query(
      `SELECT id, code, name, total_rooms AS "totalRooms"
       FROM properties WHERE code = $1`,
      [propertyCode],
    )) as Array<{ id: string; code: string; name: string; totalRooms: number | null }>;

    if (propertyRows.length !== 1) {
      throw new Error(
        `Expected exactly one property with code ${propertyCode}; found ${propertyRows.length}.`,
      );
    }

    const property = propertyRows[0];
    const actualRoomCount = await getCount(
      'SELECT COUNT(*)::int AS count FROM rooms WHERE property_id = $1',
      [property.id],
    );

    // Hillston staging is intentionally protected by its known structural room count.
    if (actualRoomCount !== 24) {
      throw new Error(
        `Refusing reset: ${propertyCode} currently has ${actualRoomCount} rooms; expected 24. Investigate structural inventory before resetting runtime data.`,
      );
    }

    console.log('StayOS staging reset target');
    console.log(
      `  DB: ${dbInfo[0]?.database ?? 'unknown'} (user ${dbInfo[0]?.db_user ?? 'unknown'})`,
    );
    console.log(`  Property: ${property.name} (${property.code})`);
    console.log(`  Rooms: ${actualRoomCount}`);
    console.log('');

    const before = await preview(property.id);
    console.table(before);

    if (!wantsApply()) {
      console.log('DRY RUN ONLY — no data changed.');
      console.log(
        `To apply: ${CONFIRM_ENV}=${EXPECTED_CONFIRMATION} ${PROPERTY_ENV}=${propertyCode} npm run staging:reset`,
      );
      return;
    }

    const deleted = await applyReset(property.id);
    console.log('');
    console.log('Reset committed. Deleted rows:');
    console.table(Array.from(deleted, ([table, count]) => ({ table, count })));

    const after = await preview(property.id);
    console.log('Post-reset state:');
    console.table(after);
    console.log(
      'Staging is now at a clean operational baseline: 24 ACTIVE/READY rooms, no stays, billing runtime, inventory ledger, maintenance tickets, or date restrictions.',
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
