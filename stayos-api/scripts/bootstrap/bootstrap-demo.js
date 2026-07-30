const { db, DEMO_PASSWORD, enumTypeExists } = require('./00-utils');

const steps = [
  require('./01-property'),
  require('./02-users'),
  require('./03-employees'),
  require('./04-guests'),
  require('./05-rooms'),
  require('./06-reservations'),
  require('./07-room-assignments'),
  require('./08-housekeeping'),
  require('./09-activity'),
];

async function main() {
  const client = db();
  const ctx = {
    summary: {},
  };

  await client.connect();
  try {
    if (await enumTypeExists(client, 'employees_department_enum')) {
      await client.query("ALTER TYPE employees_department_enum ADD VALUE IF NOT EXISTS 'ACCOUNTS'");
    }
    await client.query('BEGIN');
    for (const step of steps) {
      await step.run(client, ctx);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }

  console.log('');
  console.log('StayOS demo bootstrap complete.');
  console.log('');
  console.log('Property:');
  console.log('Hillston Hotel');
  console.log('');
  console.log('Users:');
  console.log(`${ctx.summary.users} updated`);
  console.log('');
  console.log('Employees:');
  console.log(`${ctx.summary.employees} updated`);
  console.log('');
  console.log('Guests:');
  console.log(`${ctx.summary.guests}+ updated`);
  console.log('');
  console.log('Reservations:');
  console.log(`${ctx.summary.reservations}+ updated`);
  console.log('');
  console.log('Rooms:');
  console.log(`${ctx.summary.rooms} prepared`);
  console.log('');
  console.log('Housekeeping:');
  console.log(`${ctx.summary.housekeeping} scenarios prepared`);
  console.log('');
  console.log('Login credentials:');
  for (const email of [
    'manager@stayos.local',
    'gaurav.gaur@stayos.local',
    'frontdesk@stayos.local',
    'housekeeping@stayos.local',
    'maintenance@stayos.local',
    'accounts@stayos.local',
  ]) {
    console.log(`${email} / ${DEMO_PASSWORD}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
