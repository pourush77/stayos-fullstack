#!/usr/bin/env node
/**
 * Bootstraps sample billing data: opens folios for CHECKED_IN reservations,
 * adds a few demo charges and one payment on the first folio.
 * Idempotent: skips reservations that already have a folio.
 *
 * Usage: node scripts/bootstrap-billing.js
 */
const http = require('http');

const BASE = process.env.API_BASE_URL || 'http://localhost:8001/api/v1';
const ADMIN_EMAIL = process.env.BOOTSTRAP_EMAIL || 'accounts@stayos.local';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_PASSWORD || 'Password123!';

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, body: text ? JSON.parse(text) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: text });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const login = await request('POST', '/auth/login', null, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (login.status !== 200 && login.status !== 201) {
    throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  }
  const token = login.body.data.accessToken;
  const propertyId = login.body.data.user.propertyId;
  console.log(`Logged in as ${ADMIN_EMAIL} (property=${propertyId})`);

  const reservations = await request(
    'GET',
    `/properties/${propertyId}/reservations`,
    token,
  );
  const checkedIn = (reservations.body.data || []).filter(
    (r) => r.status === 'CHECKED_IN',
  );
  console.log(`Found ${checkedIn.length} CHECKED_IN reservations`);

  const targets = checkedIn.slice(0, 4);
  const folioIds = [];
  for (const reservation of targets) {
    const folio = await request(
      'GET',
      `/properties/${propertyId}/reservations/${reservation.id}/folio`,
      token,
    );
    if (folio.status !== 200 && folio.status !== 201) {
      console.warn(
        `Failed to open folio for ${reservation.reservationCode}:`,
        folio.body,
      );
      continue;
    }
    const folioNumber = folio.body.data.folioNumber;
    folioIds.push(folio.body.data.id);
    console.log(`  ${folioNumber} for ${reservation.reservationCode}`);
  }

  if (folioIds.length === 0) {
    console.log('No folios to enrich.');
    return;
  }

  const [firstFolio, secondFolio] = folioIds;

  await request('POST', `/properties/${propertyId}/folios/${firstFolio}/charges`, token, {
    type: 'FOOD_AND_BEVERAGE',
    description: 'Room service dinner',
    quantity: 1,
    unitAmount: '1250.00',
    taxAmount: '150.00',
  });
  await request('POST', `/properties/${propertyId}/folios/${firstFolio}/charges`, token, {
    type: 'MINIBAR',
    description: 'Beverages & snacks',
    quantity: 1,
    unitAmount: '850.00',
    taxAmount: '102.00',
  });
  await request('POST', `/properties/${propertyId}/folios/${firstFolio}/payments`, token, {
    method: 'CARD',
    amount: '5000.00',
    reference: 'AUTH-8823',
  });
  console.log(`Enriched folio ${firstFolio.slice(0, 8)}... with 2 charges + 1 payment`);

  if (secondFolio) {
    await request('POST', `/properties/${propertyId}/folios/${secondFolio}/charges`, token, {
      type: 'LAUNDRY',
      description: 'Laundry service',
      quantity: 2,
      unitAmount: '250.00',
      taxAmount: '60.00',
    });
    console.log(`Enriched folio ${secondFolio.slice(0, 8)}... with 1 charge`);
  }

  const overview = await request('GET', `/properties/${propertyId}/billing/overview`, token);
  console.log('Billing overview:', overview.body.data ?? overview.body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
