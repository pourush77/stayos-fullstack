const employees = [
  ['HK-001', 'Ram', 'Kumar', 'HOUSEKEEPING', 'Room Attendant'],
  ['HK-002', 'Shyam', 'Yadav', 'HOUSEKEEPING', 'Room Attendant'],
  ['HK-003', 'Mohan', 'Singh', 'HOUSEKEEPING', 'Room Attendant'],
  ['HK-004', 'Kaju', 'Devi', 'HOUSEKEEPING', 'Room Attendant'],
  ['HK-005', 'Deepak', 'Sharma', 'HOUSEKEEPING', 'Room Attendant'],
  ['HK-006', 'Anita', 'Sharma', 'HOUSEKEEPING', 'Housekeeping Supervisor'],
  ['MT-001', 'Imran', 'Khan', 'MAINTENANCE', 'Maintenance Technician'],
  ['MT-002', 'Suresh', 'Patel', 'MAINTENANCE', 'Maintenance Technician'],
  ['FD-001', 'Priya', 'Mehra', 'FRONT_DESK', 'Front Desk Executive'],
  ['FD-002', 'Rahul', 'Sharma', 'FRONT_DESK', 'Front Desk Executive'],
  ['AC-001', 'Neha', 'Gupta', 'ACCOUNTS', 'Accounts Executive'],
];

async function run(client, ctx) {
  for (let index = 0; index < employees.length; index += 1) {
    const [code, first, last, department, designation] = employees[index];
    await client.query(
      `
        INSERT INTO employees (
          property_id, employee_code, first_name, last_name, display_name,
          department, designation, phone, status, staff_access_enabled, staff_access_token
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::employees_department_enum, $7, $8, 'ACTIVE',
          $6::text = 'HOUSEKEEPING',
          CASE WHEN $6::text = 'HOUSEKEEPING' THEN replace(uuid_generate_v4()::text, '-', '') ELSE NULL END
        )
        ON CONFLICT (property_id, employee_code) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          display_name = EXCLUDED.display_name,
          department = EXCLUDED.department,
          designation = EXCLUDED.designation,
          phone = EXCLUDED.phone,
          status = 'ACTIVE',
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
      `,
      [
        ctx.property.id,
        code,
        first,
        last,
        `${first} ${last}`,
        department,
        designation,
        `+91732000${String(index + 1).padStart(4, '0')}`,
      ],
    );
  }
  ctx.summary.employees = employees.length;
}

module.exports = { run, employees };
