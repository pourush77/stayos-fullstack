const { Client } = require('pg');

const demoEmployees = [
  ['HK-001', 'Ram', 'Kumar', 'HOUSEKEEPING', 'Room Attendant', 'ACTIVE'],
  ['HK-002', 'Shyam', 'Yadav', 'HOUSEKEEPING', 'Room Attendant', 'ACTIVE'],
  ['HK-003', 'Mohan', 'Singh', 'HOUSEKEEPING', 'Room Attendant', 'ACTIVE'],
  ['HK-004', 'Anita', 'Sharma', 'HOUSEKEEPING', 'Housekeeping Supervisor', 'ACTIVE'],
  ['MT-001', 'Imran', 'Khan', 'MAINTENANCE', 'Maintenance Technician', 'ACTIVE'],
  ['MT-002', 'Suresh', 'Patel', 'MAINTENANCE', 'Maintenance Technician', 'ACTIVE'],
  ['FD-001', 'Priya', 'Mehra', 'FRONT_DESK', 'Front Desk Executive', 'ACTIVE'],
  ['FD-002', 'Rahul', 'Sharma', 'FRONT_DESK', 'Front Desk Executive', 'ACTIVE'],
  ['AC-001', 'Neha', 'Gupta', 'ACCOUNTS', 'Accounts Executive', 'ACTIVE'],
];

const client = new Client({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME || 'stayos_dev',
  user: process.env.DATABASE_USERNAME || 'stayos',
  password: process.env.DATABASE_PASSWORD || 'StayOS@2026',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function findPropertyId() {
  const preferred = await client.query(
    `SELECT id FROM properties WHERE code = $1 AND status = 'ACTIVE' LIMIT 1`,
    ['HILLSTON_IND'],
  );

  if (preferred.rows[0]?.id) {
    return preferred.rows[0].id;
  }

  const fallback = await client.query(
    `SELECT id FROM properties WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1`,
  );

  return fallback.rows[0]?.id ?? null;
}

async function main() {
  await client.connect();
  const propertyId = await findPropertyId();

  if (!propertyId) {
    throw new Error('No active property found. Run the property bootstrap before demo employees.');
  }

  for (const [employeeCode, firstName, lastName, department, designation, status] of demoEmployees) {
    const displayName = `${firstName} ${lastName}`.trim();
    const result = await client.query(
      `
        INSERT INTO employees (
          property_id,
          employee_code,
          first_name,
          last_name,
          display_name,
          department,
          designation,
          phone,
          status,
          staff_access_enabled,
          staff_access_token
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, NULL, $8,
          $6 = 'HOUSEKEEPING',
          CASE WHEN $6 = 'HOUSEKEEPING' THEN replace(uuid_generate_v4()::text, '-', '') ELSE NULL END
        )
        ON CONFLICT (property_id, employee_code)
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          display_name = EXCLUDED.display_name,
          department = EXCLUDED.department,
          designation = EXCLUDED.designation,
          status = EXCLUDED.status,
          staff_access_enabled = CASE
            WHEN EXCLUDED.department = 'HOUSEKEEPING' THEN true
            ELSE employees.staff_access_enabled
          END,
          staff_access_token = CASE
            WHEN EXCLUDED.department = 'HOUSEKEEPING' AND employees.staff_access_token IS NULL
              THEN replace(uuid_generate_v4()::text, '-', '')
            ELSE employees.staff_access_token
          END,
          updated_at = now()
        RETURNING (xmax = 0) AS inserted
      `,
      [propertyId, employeeCode, firstName, lastName, displayName, department, designation, status],
    );

    const action = result.rows[0]?.inserted ? 'Created' : 'Updated';
    console.log(`${action} employee ${employeeCode} ${displayName}`);
  }

  console.log('Demo employees bootstrap complete.');
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end().catch(() => undefined);
  process.exit(1);
});
