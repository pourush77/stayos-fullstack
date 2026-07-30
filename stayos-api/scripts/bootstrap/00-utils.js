const crypto = require('crypto');
const { Client } = require('pg');

const PROPERTY_CODE = 'HILLSTON_IND';
const DEMO_PASSWORD = 'Password123!';

const db = () =>
  new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'stayos_dev',
    user: process.env.DATABASE_USERNAME || 'stayos',
    password: process.env.DATABASE_PASSWORD || 'StayOS@2026',
  });

const hashPassword = (password) => {
  const iterations = 210000;
  const digest = 'sha256';
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = crypto.pbkdf2Sync(password, salt, iterations, 32, digest).toString('base64url');
  return `pbkdf2$${iterations}$${digest}$${salt}$${key}`;
};

const iso = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const seedKey = (key) => `[DEMO:${key}]`;

async function one(client, query, params = []) {
  const result = await client.query(query, params);
  return result.rows[0];
}

async function mapBy(client, query, params, key) {
  const result = await client.query(query, params);
  return new Map(result.rows.map((row) => [row[key], row]));
}

async function getProperty(client) {
  const property = await one(client, 'SELECT * FROM properties WHERE code = $1', [PROPERTY_CODE]);
  if (!property) throw new Error(`Property ${PROPERTY_CODE} must be bootstrapped first`);
  return property;
}

async function columnExists(client, table, column) {
  const row = await one(
    client,
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `,
    [table, column],
  );
  return Boolean(row);
}

async function enumTypeExists(client, typeName) {
  const row = await one(
    client,
    `
      SELECT 1
      FROM pg_type type
      JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'public' AND type.typname = $1
    `,
    [typeName],
  );
  return Boolean(row);
}

async function reservationCode(client, propertyId, index) {
  const existing = await one(
    client,
    'SELECT reservation_code FROM reservations WHERE property_id = $1 AND notes LIKE $2',
    [propertyId, `%${seedKey(`RSV-${String(index).padStart(3, '0')}`)}%`],
  );
  if (existing) return existing.reservation_code;
  return `HSDEMO-${String(index).padStart(4, '0')}`;
}

module.exports = {
  DEMO_PASSWORD,
  PROPERTY_CODE,
  db,
  getProperty,
  hashPassword,
  iso,
  mapBy,
  one,
  columnExists,
  enumTypeExists,
  reservationCode,
  seedKey,
};
