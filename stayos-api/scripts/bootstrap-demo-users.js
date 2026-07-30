const crypto = require('crypto');
const { Client } = require('pg');

const demoPassword = 'Password123!';
const users = [
  ['StayOS Owner', 'owner@stayos.local', 'OWNER'],
  ['StayOS Admin', 'admin@stayos.local', 'ADMIN'],
  ['StayOS Manager', 'manager@stayos.local', 'MANAGER'],
  ['Front Desk', 'frontdesk@stayos.local', 'FRONT_DESK'],
  ['Housekeeping', 'housekeeping@stayos.local', 'HOUSEKEEPING'],
  ['Maintenance', 'maintenance@stayos.local', 'MAINTENANCE'],
  ['Accounts', 'accounts@stayos.local', 'ACCOUNTS'],
  ['Read Only', 'readonly@stayos.local', 'READ_ONLY'],
];

const hashPassword = (password) => {
  const iterations = 210000;
  const digest = 'sha256';
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = crypto.pbkdf2Sync(password, salt, iterations, 32, digest).toString('base64url');

  return `pbkdf2$${iterations}$${digest}$${salt}$${key}`;
};

const client = new Client({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME || 'stayos_dev',
  user: process.env.DATABASE_USERNAME || 'stayos',
  password: process.env.DATABASE_PASSWORD || 'StayOS@2026',
});

async function main() {
  await client.connect();
  const propertyResult = await client.query('SELECT id FROM properties WHERE code = $1', [
    'HILLSTON_IND',
  ]);
  const propertyId = propertyResult.rows[0]?.id ?? null;

  for (const [name, email, role] of users) {
    await client.query(
      `
        INSERT INTO users (property_id, name, email, password_hash, role, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        ON CONFLICT (email)
        DO UPDATE SET
          property_id = EXCLUDED.property_id,
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          status = 'ACTIVE',
          updated_at = now()
      `,
      [propertyId, name, email, hashPassword(demoPassword), role],
    );
  }

  console.log('Demo users bootstrapped');
  console.log('Password for all demo users: Password123!');
  console.log('Demo credentials are for local development only.');
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end().catch(() => undefined);
  process.exit(1);
});
