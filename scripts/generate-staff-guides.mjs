import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const password = process.env.E2E_PASSWORD ?? 'Password123!';
const outputDir = path.resolve('docs/staff-guides');
const screenshotDir = path.join(outputDir, 'screenshots');

const roles = [
  {
    key: 'front-desk',
    title: 'Front Desk V1 Staff Guide',
    email: 'frontdesk@stayos.local',
    landing: '/',
    routes: [
      { slug: 'front-desk-home', path: '/', caption: 'Front Desk dashboard: daily actions, arrivals, room assignment, and queue.' },
      { slug: 'ready-rooms', path: '/rooms?mode=assign&status=ready', caption: 'Ready rooms view: use this when assigning a room to an arriving guest.' },
      { slug: 'bookings-departures', path: '/reservations?filter=departures-today', caption: 'Departures list: use this before checkout.' },
      { slug: 'availability', path: '/reservations/availability', caption: 'Availability calendar: inspect sellable rooms, blocks, and group holds.' },
    ],
    sections: [
      ['Start of shift', ['Open Front Desk dashboard.', 'Review Action Queue first.', 'Check arrivals, departures, rooms to clean, and guests in house.']],
      ['New booking', ['Click New Booking.', 'Create or select guest.', 'Pick stay dates, room type, guests, and payment plan.', 'Create booking, then assign room when ready.']],
      ['Assign room', ['Click Assign Room.', 'Only ready rooms are shown.', 'Choose a guest from eligible reservations.', 'After assignment, continue to check-in.']],
      ['Check-in', ['Verify identity.', 'Complete missing guest details.', 'Review payment plan.', 'Confirm room is ready.', 'Complete check-in.']],
      ['Checkout', ['Open Check Out.', 'Open due departure.', 'Collect any balance before final checkout.', 'Complete checkout only after billing is settled.']],
      ['If something is blocked', ['Read the message first. Most blocked actions explain the missing step.', 'If a room is not shown, it is usually not ready, already occupied, assigned, or incompatible.', 'If checkout is blocked, collect or settle the outstanding balance first.', 'If the guest details step does not clear, check address, country, state, city, purpose of visit, mobile, and nationality.']],
      ['What to report during pilot', ['Wrong count on dashboard cards.', 'Eligible reservation not visible in Assign Guest.', 'Wrong balance or paid booking showing due.', 'Check-in or checkout button disabled without a clear reason.', 'Any screen where staff cannot understand the next action.']],
    ],
    doNot: ['Do not use Billing or Settings directly unless manager gives access.', 'Do not checkout with an unpaid balance.', 'Do not assign rooms outside the ready-room flow unless needed.'],
  },
  {
    key: 'manager',
    title: 'Manager V1 Staff Guide',
    email: 'manager@stayos.local',
    landing: '/',
    routes: [
      { slug: 'manager-home', path: '/', caption: 'Manager dashboard: broad operational overview.' },
      { slug: 'bookings', path: '/reservations', caption: 'Bookings: review arrivals, departures, checked-in stays, and groups.' },
      { slug: 'rooms', path: '/rooms', caption: 'Rooms: monitor inventory, readiness, occupancy, and blocked rooms.' },
      { slug: 'billing', path: '/billing', caption: 'Billing: review folios and payment status.' },
    ],
    sections: [
      ['Daily review', ['Check front desk queue.', 'Review arrivals and departures.', 'Inspect room readiness and housekeeping load.', 'Review billing exceptions.']],
      ['Approvals', ['Review rate/payment exceptions.', 'Help staff resolve blocked check-ins or checkouts.', 'Escalate data issues before staff continues.']],
      ['Staff support', ['Use role views to understand what staff can see.', 'Guide front desk through normal flow instead of manual shortcuts.']],
      ['V1 pilot review', ['Review staff issues at the end of each shift.', 'Separate blockers from polish requests.', 'Confirm financial issues before marking them resolved.', 'Approve any data reset or correction before it is done.']],
    ],
    doNot: ['Do not change demo configuration during staff pilot unless required.', 'Do not delete records during V1 testing.'],
  },
  {
    key: 'housekeeping',
    title: 'Housekeeping V1 Staff Guide',
    email: 'housekeeping@stayos.local',
    landing: '/housekeeping',
    routes: [
      { slug: 'housekeeping-home', path: '/housekeeping', caption: 'Housekeeping workspace: rooms grouped by cleaning status and priority.' },
      { slug: 'housekeeping-filtered', path: '/housekeeping', caption: 'Use filters/search to find rooms by floor, status, or staff member.' },
    ],
    sections: [
      ['Cleaning workflow', ['Open Housekeeping.', 'Review dirty/inspection rooms.', 'Start work on assigned room.', 'Mark cleaning complete when done.', 'Send room for inspection if required.']],
      ['Room status', ['Only update housekeeping status when the actual room condition changed.', 'Use notes for maintenance or inspection blockers.']],
      ['Priority handling', ['Clean checkout rooms first when front desk is waiting for saleable rooms.', 'Flag maintenance issues instead of marking the room ready.', 'Use search and filters when the room list is long.']],
    ],
    doNot: ['Do not create bookings.', 'Do not assign guest rooms.', 'Do not access billing or front desk-only workflows.'],
  },
  {
    key: 'maintenance',
    title: 'Maintenance V1 Staff Guide',
    email: 'maintenance@stayos.local',
    landing: '/maintenance',
    routes: [
      { slug: 'maintenance-home', path: '/maintenance', caption: 'Maintenance workspace: unavailable rooms and operational issues.' },
    ],
    sections: [
      ['Maintenance workflow', ['Open Maintenance.', 'Review unavailable/out-of-order rooms.', 'Update task status as work progresses.', 'Mark resolved only when room can return to operations.']],
      ['Coordination', ['Coordinate with housekeeping before room returns to sellable inventory.', 'Keep notes short and operational.']],
      ['Operational impact', ['Out-of-order rooms should not appear as ready for assignment.', 'Tell front desk when a room cannot be sold today.', 'Use clear room numbers and short notes in every update.']],
    ],
    doNot: ['Do not assign reservations.', 'Do not change billing.', 'Do not mark a room ready unless operationally cleared.'],
  },
  {
    key: 'accounts',
    title: 'Accounts V1 Staff Guide',
    email: 'accounts@stayos.local',
    landing: '/billing',
    routes: [
      { slug: 'billing-home', path: '/billing', caption: 'Billing workspace: folios, balances, payments, and settlement review.' },
    ],
    sections: [
      ['Billing workflow', ['Open Billing.', 'Search folio or guest.', 'Review charges and payments.', 'Collect or record payment only when verified.', 'Confirm balance before checkout support.']],
      ['Payment checks', ['Paid stays should show zero balance.', 'Payment due stays must show the correct outstanding amount.', 'Receipts should be available after payment is recorded.']],
      ['Exceptions', ['Do not settle unclear folios without manager approval.', 'Check tax, room charge, and posted extras before checkout.', 'Record payment method and reference when available.']],
    ],
    doNot: ['Do not change room status.', 'Do not assign rooms.', 'Do not run front desk check-in unless role access is changed by manager.'],
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loginAs(page, email) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.localStorage.removeItem('stayos.manualLogout');
      window.sessionStorage.removeItem('stayos.manualLogout');
    });
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    } catch (error) {
      if (attempt === 3) {
        const message = await page
          .locator('[role="alert"], text=/Invalid|failed|Unable|error/i')
          .first()
          .textContent()
          .catch(() => '');
        throw new Error(`Unable to log in as ${email}. ${message}`.trim());
      }
      await page.waitForTimeout(750);
    }
  }
}

async function discoverReservationId(page, status) {
  const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';
  return page.evaluate(
    async ({ baseUrl, targetStatus }) => {
      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');
      if (!token) return null;

      const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
      const unwrap = (payload) => {
        if (payload && typeof payload === 'object') {
          if ('data' in payload && payload.data !== undefined) return payload.data;
          if ('items' in payload && payload.items !== undefined) return payload.items;
          if ('results' in payload && payload.results !== undefined) return payload.results;
        }
        return payload;
      };

      const propertiesResponse = await fetch(`${baseUrl}/properties`, { headers });
      if (!propertiesResponse.ok) return null;
      const properties = unwrap(await propertiesResponse.json());
      const activeProperty =
        properties.find((property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
        properties[0];
      const propertyId = typeof activeProperty?.id === 'string' ? activeProperty.id : '';
      if (!propertyId) return null;

      const reservationsResponse = await fetch(`${baseUrl}/properties/${propertyId}/reservations`, {
        headers,
      });
      if (!reservationsResponse.ok) return null;
      const reservations = unwrap(await reservationsResponse.json());
      const match = reservations.find(
        (reservation) => String(reservation.status ?? '').toUpperCase() === targetStatus,
      );
      return match?.id ?? match?._id ?? match?.uuid ?? null;
    },
    { baseUrl: apiBaseUrl, targetStatus: status },
  );
}

async function addDynamicRoutes(role, page) {
  if (!['front-desk', 'manager'].includes(role.key)) return;

  const checkInReservationId = await discoverReservationId(page, 'CONFIRMED').catch(() => null);
  if (checkInReservationId) {
    role.routes.push({
      slug: 'check-in-workspace',
      path: `/reservations/${checkInReservationId}/check-in`,
      caption: 'Check-in wizard: verify identity, complete guest details, review payment, and confirm room.',
    });
  }

  const checkedInReservationId = await discoverReservationId(page, 'CHECKED_IN').catch(() => null);
  if (checkedInReservationId) {
    role.routes.push({
      slug: 'stay-workspace',
      path: `/guest-stay/${checkedInReservationId}`,
      caption: 'Stay workspace: guest service, billing, payment, documents, and checkout readiness.',
    });
  }
}

function htmlForGuide(role, capturedAt) {
  const screenshots = role.routes
    .map(
      (route) => `
        <section class="screenshot">
          <h3>${escapeHtml(route.caption)}</h3>
          <img src="screenshots/${role.key}-${route.slug}.png" alt="${escapeHtml(route.caption)}" />
        </section>
      `,
    )
    .join('');

  const sections = role.sections
    .map(
      ([heading, items]) => `
        <section>
          <h2>${escapeHtml(heading)}</h2>
          <ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
        </section>
      `,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(role.title)}</title>
  <style>
    @page { margin: 18mm; }
    body { color: #101828; font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.45; margin: 0; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { border-top: 1px solid #e2e8f0; font-size: 17px; margin: 22px 0 8px; padding-top: 14px; }
    h3 { color: #334155; font-size: 14px; margin: 0 0 8px; }
    .meta { color: #64748b; margin-bottom: 18px; }
    .pill { background: #f3e8ff; border-radius: 999px; color: #5b21b6; display: inline-block; font-size: 11px; font-weight: 800; margin: 4px 6px 4px 0; padding: 5px 9px; text-transform: uppercase; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 14px 0; padding: 14px; }
    .warning { background: #fff7ed; border-color: #fed7aa; }
    ol, ul { margin: 6px 0 0 18px; padding: 0; }
    li { margin: 5px 0; }
    img { border: 1px solid #dbe3ef; border-radius: 10px; display: block; max-width: 100%; width: 100%; }
    .screenshot { break-inside: avoid; margin-top: 18px; }
    .cover { border-bottom: 3px solid #7c3aed; margin-bottom: 18px; padding-bottom: 14px; }
    .footer { color: #64748b; font-size: 10px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="pill">StayOS V1 Staff Pilot</div>
    <h1>${escapeHtml(role.title)}</h1>
    <div class="meta">Account: ${escapeHtml(role.email)} | Password: Password123! | Generated: ${escapeHtml(capturedAt)}</div>
    <p>This guide is for staff pilot testing. Follow normal hotel operations and report anything confusing, blocked, or financially incorrect.</p>
  </div>

  ${sections}

  <section class="card warning">
    <h2>Do Not</h2>
    <ul>${role.doNot.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </section>

  <section class="card">
    <h2>Report Issues Like This</h2>
    <ul>
      <li>Role and page</li>
      <li>What you clicked</li>
      <li>What happened</li>
      <li>What you expected</li>
      <li>Screenshot and severity</li>
    </ul>
  </section>

  ${screenshots}

  <div class="footer">StayOS V1 role guide. Keep this document internal to staff testing.</div>
</body>
</html>`;
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const capturedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  try {
    for (const role of roles) {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await loginAs(page, role.email);
      await addDynamicRoutes(role, page);

      for (const route of role.routes) {
        await page.goto(`${baseURL}${route.path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.screenshot({
          fullPage: true,
          path: path.join(screenshotDir, `${role.key}-${route.slug}.png`),
        });
      }

      await context.close();

      const html = htmlForGuide(role, capturedAt);
      const htmlPath = path.join(outputDir, `${role.key}-staff-guide.html`);
      const pdfPath = path.join(outputDir, `${role.key}-staff-guide.pdf`);
      await writeFile(htmlPath, html, 'utf8');

      const pdfPage = await browser.newPage();
      await pdfPage.goto(`file://${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' });
      await pdfPage.pdf({
        format: 'A4',
        path: pdfPath,
        printBackground: true,
      });
      await pdfPage.close();
      console.log(`Created ${pdfPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
