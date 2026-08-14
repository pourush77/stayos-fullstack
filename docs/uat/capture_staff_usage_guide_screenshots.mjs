import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e') });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const managerEmail = process.env.E2E_MANAGER_EMAIL;
const managerPassword = process.env.E2E_MANAGER_PASSWORD;
const frontDeskEmail = process.env.E2E_FRONTDESK_EMAIL;
const frontDeskPassword = process.env.E2E_FRONTDESK_PASSWORD;
const screenshotDir = path.resolve(process.cwd(), 'docs/uat/screenshots');

function required(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function login(page, email, password) {
  await page.goto(`${baseURL}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.getByTestId('login-password').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login')),
    page.getByRole('button', { name: /sign in|login|log in/i }).click(),
  ]);
}

async function logout(page) {
  const signOut = page.getByRole('button', { name: /sign out|log out|logout/i }).first();
  if (await signOut.count()) {
    await Promise.all([page.waitForURL(/\/login/), signOut.click()]);
    return;
  }
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function configureRoomOccupancy(page, roomTypeName) {
  await page.goto(`${baseURL}/settings/room-types`);
  const card = page
    .locator('[data-testid^="room-type"], article, .mantine-Card-root')
    .filter({ hasText: new RegExp(roomTypeName, 'i') })
    .first();
  await card.getByLabel(/standard occupancy/i).fill('2');
  await card.getByLabel(/maximum occupancy/i).fill('3');
  await card.getByLabel(/maximum adults/i).fill('2');
  await card.getByLabel(/maximum children/i).fill('1');
  const save = card.getByRole('button', { name: /save occupancy/i });
  if (await save.isEnabled()) {
    await Promise.all([
      page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/v1\/properties\/[^/]+\/room-types\/[^/]+$/.test(response.url()),
      ),
      save.click(),
    ]);
  }
}

async function configureChildPricing(page) {
  await page.goto(`${baseURL}/settings/rates`);
  const ageBasedSwitch = page.locator('input[type="checkbox"]').first();
  if (!(await ageBasedSwitch.isChecked())) await ageBasedSwitch.check({ force: true });

  const maxAgeLabel = page.getByText('Maximum child age', { exact: true });
  await maxAgeLabel.locator('..').locator('input').first().fill('17');

  const ageBandCard = (label) =>
    page.locator(`input[value="${label}"]`).locator('xpath=ancestor::*[contains(@class,"mantine-Card-root")][1]');

  const youngChild = ageBandCard('Young Child');
  await youngChild.getByLabel('From age', { exact: true }).fill('0');
  await youngChild.getByLabel('To age', { exact: true }).fill('5');
  await youngChild.getByLabel('Pricing', { exact: true }).click();
  await page.getByRole('option', { name: 'Free', exact: true }).click();

  const child = ageBandCard('Child');
  await child.getByLabel('From age', { exact: true }).fill('6');
  await child.getByLabel('To age', { exact: true }).fill('11');
  await child.getByLabel('Pricing', { exact: true }).click();
  await page.getByRole('option', { name: 'Fixed amount per night', exact: true }).click();
  await child.getByLabel('Amount per child / night', { exact: true }).fill('850.00');

  const olderChild = ageBandCard('Older Child');
  await olderChild.getByLabel('From age', { exact: true }).fill('12');
  await olderChild.getByLabel('To age', { exact: true }).fill('17');
  await olderChild.getByLabel('Pricing', { exact: true }).click();
  await page.getByRole('option', { name: 'Use adult pricing', exact: true }).click();

  const save = page.getByRole('button', { name: /save changes/i });
  if (await save.isEnabled()) {
    await Promise.all([
      page.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        /\/api\/v1\/properties\/[^/]+\/rates\/guest-pricing-policy$/.test(response.url()),
      ),
      save.click(),
    ]);
  }
}

async function configureTax(page) {
  await page.goto(`${baseURL}/settings/taxes`);
  const enabled = page.getByTestId('tax-enabled-toggle');
  if (!(await enabled.isChecked())) await enabled.click();
  await page.getByTestId('tax-name-input').fill('GST');
  await page.getByTestId('tax-percentage-input').fill('12');
  await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      /\/api\/v1\/properties\/[^/]+\/rates\/taxes$/.test(response.url()),
    ),
    page.getByTestId('tax-save-button').click(),
  ]);
}

async function chooseOneNight(page) {
  await page.getByRole('button', { name: /select arrival.*departure/i }).click();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const label = (date) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  const calendar = page.getByRole('dialog');
  await calendar.getByRole('button', { name: label(today), exact: true }).click();
  await calendar.getByRole('button', { name: label(tomorrow), exact: true }).click();
}

async function prepareBooking(page) {
  await page.goto(`${baseURL}/reservations/new`);
  const guestSelect = page.getByTestId('booking-guest-select');
  await guestSelect.click();
  await page.getByRole('option').first().click();
  await chooseOneNight(page);

  const deluxe = page.locator('[data-testid^="room-type-option-"]').filter({ hasText: /Deluxe/i }).first();
  await deluxe.click();
  await page.getByLabel(/^Adults$/i).fill('2');
  await page.getByLabel(/^Children$/i).fill('2');
}

async function capture(locator, name) {
  await locator.screenshot({ path: path.join(screenshotDir, name) });
}

async function main() {
  required('E2E_MANAGER_EMAIL', managerEmail);
  required('E2E_MANAGER_PASSWORD', managerPassword);
  required('E2E_FRONTDESK_EMAIL', frontDeskEmail);
  required('E2E_FRONTDESK_PASSWORD', frontDeskPassword);

  await fs.mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await login(page, managerEmail, managerPassword);
  await configureRoomOccupancy(page, 'Deluxe');
  await configureRoomOccupancy(page, 'Suite');
  await page.goto(`${baseURL}/settings/room-types`);
  await capture(
    page.locator('.mantine-Card-root').filter({ hasText: /Deluxe/i }).first(),
    '01-room-occupancy.png',
  );

  await configureChildPricing(page);
  await page.goto(`${baseURL}/settings/rates`);
  await capture(page.getByTestId('rates-settings-page'), '02-child-pricing.png');

  await configureTax(page);
  await page.goto(`${baseURL}/settings/taxes`);
  await capture(page.getByTestId('tax-settings-page'), '03-taxes.png');

  await logout(page);
  await login(page, frontDeskEmail, frontDeskPassword);
  await prepareBooking(page);
  await capture(page.locator('main, [role="main"]').first().or(page.locator('body')), '04-invalid-occupancy.png');

  await page.getByLabel(/^Children$/i).fill('1');
  const bookableRoom = page.locator('[data-testid^="room-type-option-"]').filter({ hasNotText: /Sold out/i }).first();
  await bookableRoom.click();
  const childAge = page.getByLabel(/child 1 age/i);
  await childAge.click();
  await childAge.pressSequentially('9');
  await capture(page.locator('main, [role="main"]').first().or(page.locator('body')), '05-booking-details.png');
  await capture(page.locator('.mantine-Card-root').filter({ hasText: /Confirm/i }).first(), '06-confirm-total.png');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
