const { mapBy } = require('./00-utils');

const checklist = [
  { key: 'BED', done: true },
  { key: 'BATHROOM', done: true },
  { key: 'TOWELS', done: true },
  { key: 'TOILETRIES', done: true },
  { key: 'MIRROR', done: true },
  { key: 'FLOOR', done: true },
  { key: 'DUSTBIN', done: true },
];

async function run(client, ctx) {
  console.log('Skipped unsupported scenario: CLEANING room status is not present in rooms_operational_status_enum; room 208 uses NEEDS_CLEANING with started_at');
  const employees = await mapBy(
    client,
    'SELECT * FROM employees WHERE property_id = $1',
    [ctx.property.id],
    'employee_code',
  );
  const scenarios = [
    ['203', 'NEEDS_CLEANING', null, null, null, null, null],
    ['204', 'NEEDS_CLEANING', 'HK-004', null, null, null, null],
    ['207', 'NEEDS_CLEANING', 'HK-005', null, null, null, null],
    ['208', 'NEEDS_CLEANING', 'HK-001', new Date(), null, null, null],
    ['206', 'INSPECTION', 'HK-002', null, new Date(), new Date(), checklist],
    ['209', 'NEEDS_CLEANING', null, null, null, null, null],
    ['311', 'MAINTENANCE', 'MT-001', null, null, null, null],
    ['312', 'OUT_OF_SERVICE', null, null, null, null, null],
  ];

  for (const [room, status, employeeCode, startedAt, completedAt, inspectedAt, roomChecklist] of scenarios) {
    const employee = employeeCode ? employees.get(employeeCode) : null;
    await client.query(
      `
        UPDATE rooms SET
          operational_status = $2,
          assigned_employee_id = $3,
          started_at = $4,
          completed_at = $5,
          inspected_at = $6,
          completed_by_employee_id = $7,
          checklist = $8,
          rework_reason = CASE WHEN room_number = '209' THEN 'Bathroom' ELSE NULL END,
          operational_status_reason = CASE
            WHEN room_number = '311' THEN 'Maintenance reported'
            WHEN room_number = '312' THEN 'Out of service for QA scenario'
            WHEN room_number = '209' THEN 'Rework required'
            ELSE NULL
          END,
          operational_status_note = $9,
          updated_at = now()
        WHERE property_id = $1 AND room_number = $10
      `,
      [
        ctx.property.id,
        status,
        employee?.id || null,
        startedAt,
        completedAt,
        inspectedAt,
        completedAt ? employee?.id || null : null,
        JSON.stringify(roomChecklist || []),
        `Demo housekeeping scenario for room ${room}`,
        room,
      ],
    );
  }
  ctx.summary.housekeeping = scenarios.length;
}

module.exports = { run };
