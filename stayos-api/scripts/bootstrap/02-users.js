const { DEMO_PASSWORD, hashPassword } = require('./00-utils');

const users = [
  ['StayOS Owner', 'owner@stayos.local', 'OWNER'],
  ['StayOS Admin', 'admin@stayos.local', 'ADMIN'],
  ['StayOS Manager', 'manager@stayos.local', 'MANAGER'],
  ['Gaurav Gaur', 'gaurav.gaur@stayos.local', 'MANAGER'],
  ['Priya Front Desk', 'frontdesk@stayos.local', 'FRONT_DESK'],
  ['Anita Housekeeping', 'housekeeping@stayos.local', 'HOUSEKEEPING'],
  ['Imran Maintenance', 'maintenance@stayos.local', 'MAINTENANCE'],
  ['Neha Accounts', 'accounts@stayos.local', 'ACCOUNTS'],
  ['Read Only User', 'readonly@stayos.local', 'READ_ONLY'],
];

async function run(client, ctx) {
  for (const [name, email, role] of users) {
    await client.query(
      `
        INSERT INTO users (property_id, name, email, password_hash, role, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        ON CONFLICT (email) DO UPDATE SET
          property_id = EXCLUDED.property_id,
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          status = 'ACTIVE',
          updated_at = now()
      `,
      [ctx.property.id, name, email, hashPassword(DEMO_PASSWORD), role],
    );
  }
  ctx.summary.users = users.length;
}

module.exports = { run };
