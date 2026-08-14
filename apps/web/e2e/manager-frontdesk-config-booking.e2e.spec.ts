import { expect, test, type Page } from '@playwright/test';

/**
 * StayOS E2E
 *
 * Manager configuration -> Front Desk booking consumption
 *
 * Required environment variables:
 *   E2E_MANAGER_EMAIL
 *   E2E_MANAGER_PASSWORD
 *   E2E_FRONTDESK_EMAIL
 *   E2E_FRONTDESK_PASSWORD
 *
 * Assumptions:
 * - Playwright baseURL points to the StayOS web app.
 * - The test property contains a "Deluxe" room type.
 * - Guest & Child Pricing exists under /settings/rates.
 * - Room Type occupancy settings exist under /settings/room-types.
 *
 * The test deliberately avoids hard-coding property IDs or bearer tokens.
 */

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL;
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD;
const FRONTDESK_EMAIL = process.env.E2E_FRONTDESK_EMAIL;
const FRONTDESK_PASSWORD = process.env.E2E_FRONTDESK_PASSWORD;

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');

  await page.locator('input[type="email"]').fill(email);
  await page.getByTestId('login-password').fill(password);

  const loginButton = page.getByRole('button', {
    name: /sign in|login|log in/i,
  });

  await expect(loginButton).toBeEnabled();
  await loginButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

async function logout(page: Page) {
  const directLogout = page.getByRole('button', { name: /log out|logout|sign out/i });

  if (await directLogout.count()) {
    await directLogout.first().click();
  } else {
    const profileMenu = page.getByRole('button', {
      name: /profile|account|user|menu/i,
    });

    if (await profileMenu.count()) {
      await profileMenu.first().click();
    } else {
      const fallbackMenu = page.locator(
        '[data-testid*="profile"], [data-testid*="user-menu"], [aria-haspopup="menu"]',
      );
      await fallbackMenu.first().click();
    }

    await page.getByRole('menuitem', { name: /log out|logout|sign out/i }).click();
  }

  await page.waitForURL(/\/login/);
}

async function configureRoomOccupancy(page: Page, roomTypeName: string) {
  await page.goto('/settings/room-types');

  const roomTypeCard = page
    .locator('[data-testid^="room-type"], article, .mantine-Card-root')
    .filter({ hasText: new RegExp(roomTypeName, 'i') })
    .first();

  await expect(roomTypeCard).toBeVisible();

  await roomTypeCard.getByLabel(/standard occupancy/i).fill('2');
  await roomTypeCard.getByLabel(/maximum occupancy/i).fill('3');
  await roomTypeCard.getByLabel(/maximum adults/i).fill('2');
  await roomTypeCard.getByLabel(/maximum children/i).fill('1');

  await expect(roomTypeCard).toContainText(/2 adults.*1 child.*3 guests total/i);

  const saveOccupancy = roomTypeCard.getByRole('button', { name: /save occupancy/i });
  await expect(saveOccupancy).toBeEnabled();

  const updateOccupancyResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/api\/v1\/properties\/[^/]+\/room-types\/[^/]+$/.test(response.url()),
  );

  await saveOccupancy.click();

  const response = await updateOccupancyResponse;

  expect(
    response.ok(),
    `Room occupancy update failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

async function configureChildPricing(page: Page) {
  await page.goto('/settings/rates');

  await expect(page.getByTestId('rates-settings-page')).toBeVisible();

  // ---------------------------------------------------------
  // Enable age-based pricing
  // ---------------------------------------------------------

  const ageBasedSwitch = page.locator('input[type="checkbox"]').first();

  await expect(ageBasedSwitch).toBeAttached();

  if (!(await ageBasedSwitch.isChecked())) {
    await ageBasedSwitch.check({ force: true });
  }

  // ---------------------------------------------------------
  // Maximum child age = 17
  // ---------------------------------------------------------

  const maximumChildAge = page.getByText('Maximum child age', {
    exact: true,
  });

  const maximumChildAgeContainer = maximumChildAge.locator('..');

  const maximumChildAgeInput = maximumChildAgeContainer.locator('input').first();

  await maximumChildAgeInput.fill('17');

  // ---------------------------------------------------------
  // Locate the three age-band cards
  // ---------------------------------------------------------

  const ageBandCard = (label: string) =>
    page
      .locator(`input[value="${label}"]`)
      .locator('xpath=ancestor::*[contains(@class,"mantine-Card-root")][1]');

  const youngChildCard = ageBandCard('Young Child');
  const childCard = ageBandCard('Child');
  const olderChildCard = ageBandCard('Older Child');

  // ---------------------------------------------------------
  // Young Child: age 0-5 = FREE
  // ---------------------------------------------------------

  await youngChildCard.getByLabel('From age', { exact: true }).fill('0');

  await youngChildCard.getByLabel('To age', { exact: true }).fill('5');

  const youngPricing = youngChildCard.getByLabel('Pricing', {
    exact: true,
  });

  await youngPricing.click();

  await page.getByRole('option', { name: 'Free', exact: true }).click();

  // ---------------------------------------------------------
  // Child: age 6-11 = ₹850 / night
  // ---------------------------------------------------------

  await childCard.getByLabel('From age', { exact: true }).fill('6');

  await childCard.getByLabel('To age', { exact: true }).fill('11');

  const childPricing = childCard.getByLabel('Pricing', {
    exact: true,
  });

  await childPricing.click();

  await page
    .getByRole('option', {
      name: 'Fixed amount per night',
      exact: true,
    })
    .click();

  const fixedAmountInput = childCard.getByLabel('Amount per child / night', {
    exact: true,
  });

  await fixedAmountInput.fill('850.00');

  // ---------------------------------------------------------
  // Older Child: age 12-17 = Adult Pricing
  // ---------------------------------------------------------

  await olderChildCard.getByLabel('From age', { exact: true }).fill('12');

  await olderChildCard.getByLabel('To age', { exact: true }).fill('17');

  const olderChildPricing = olderChildCard.getByLabel('Pricing', {
    exact: true,
  });

  await olderChildPricing.click();

  await page
    .getByRole('option', {
      name: 'Use adult pricing',
      exact: true,
    })
    .click();

  // ---------------------------------------------------------
  // Save and verify actual API request
  // ---------------------------------------------------------

  const saveButton = page.getByRole('button', {
    name: /save changes/i,
  });

  await expect(saveButton).toBeEnabled();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      /\/api\/v1\/properties\/[^/]+\/rates\/guest-pricing-policy$/.test(response.url()),
  );

  await saveButton.click();

  const saveResponse = await saveResponsePromise;

  expect(
    saveResponse.ok(),
    `Guest pricing policy save failed: ${saveResponse.status()} ${await saveResponse.text()}`,
  ).toBeTruthy();

  // Your real UI explicitly shows this after a successful save.
  await expect(
    page.getByText('Guest pricing policy saved successfully.', {
      exact: true,
    }),
  ).toBeVisible();
}

async function configureTax(page: Page) {
  await page.goto('/settings/taxes');

  await expect(page.getByTestId('tax-settings-page')).toBeVisible();

  const enabled = page.getByTestId('tax-enabled-toggle');
  await expect(enabled).toBeVisible();
  if (!(await enabled.isChecked())) {
    await enabled.click();
  }

  await page.getByTestId('tax-name-input').fill('GST');
  await page.getByTestId('tax-percentage-input').fill('12');

  await expect(page.getByText(/GST 12%/i)).toBeVisible();
  await expect(page.getByText(/4,872/)).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      /\/api\/v1\/properties\/[^/]+\/rates\/taxes$/.test(response.url()),
  );

  await page.getByTestId('tax-save-button').click();
  const saveResponse = await saveResponsePromise;

  expect(
    saveResponse.ok(),
    `Tax config save failed: ${saveResponse.status()} ${await saveResponse.text()}`,
  ).toBeTruthy();

  await expect(page.getByText('Tax configuration saved successfully.', { exact: true })).toBeVisible();
}

async function ensureGuestSelected(page: Page) {
  const guestSelect = page.getByTestId('booking-guest-select');
  await expect(guestSelect).toBeVisible();

  await guestSelect.click();

  const firstOption = page.getByRole('option').first();
  if (await firstOption.count()) {
    await firstOption.click();
    return;
  }

  throw new Error(
    'No guest is available for the E2E booking. Seed at least one guest or extend this test to create one.',
  );
}

async function chooseOneNight(page: Page) {
  const dateInput = page.getByRole('button', { name: /select arrival.*departure/i });

  await expect(dateInput).toBeVisible();
  await dateInput.click();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dateLabel = (date: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);

  const calendar = page.getByRole('dialog');
  await calendar.getByRole('button', { name: dateLabel(today), exact: true }).click();
  await calendar.getByRole('button', { name: dateLabel(tomorrow), exact: true }).click();

  await expect(page.getByText(/1 night/i).first()).toBeVisible();
}

async function chooseDeluxe(page: Page) {
  const deluxeOption = page
    .locator('[data-testid^="room-type-option-"]')
    .filter({ hasText: /Deluxe/i })
    .first();

  await expect(deluxeOption).toBeVisible();
  await deluxeOption.click();

  return deluxeOption;
}

async function chooseBookableRoom(page: Page) {
  const roomOption = page
    .locator('[data-testid^="room-type-option-"]')
    .filter({ hasNotText: /Sold out/i })
    .first();

  await expect(roomOption).toBeVisible();
  await roomOption.click();

  return roomOption;
}

test.describe('Manager configuration -> Front Desk booking', () => {
  test('room occupancy and child pricing configured by Manager drive Front Desk booking', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const managerEmail = requiredEnv('E2E_MANAGER_EMAIL', MANAGER_EMAIL);
    const managerPassword = requiredEnv('E2E_MANAGER_PASSWORD', MANAGER_PASSWORD);
    const frontDeskEmail = requiredEnv('E2E_FRONTDESK_EMAIL', FRONTDESK_EMAIL);
    const frontDeskPassword = requiredEnv('E2E_FRONTDESK_PASSWORD', FRONTDESK_PASSWORD);

    await login(page, managerEmail, managerPassword);
    await configureRoomOccupancy(page, 'Deluxe');
    await configureRoomOccupancy(page, 'Suite');
    await configureChildPricing(page);
    await configureTax(page);

    await logout(page);
    await login(page, frontDeskEmail, frontDeskPassword);

    await page.goto('/reservations/new');

    await ensureGuestSelected(page);
    await chooseOneNight(page);

    const deluxeOption = await chooseDeluxe(page);

    const adultsInput = page.getByLabel(/^Adults$/i);
    const childrenInput = page.getByLabel(/^Children$/i);

    await adultsInput.fill('2');
    await childrenInput.fill('2');

    await expect(deluxeOption).toContainText(/Max 2A \/ 1C/i);
    await expect(page.getByText(/Deluxe allows up to 1 child/i).first()).toBeVisible();

    const createBooking = page.getByRole('button', { name: /create booking/i });
    await expect(createBooking).toBeDisabled();

    await childrenInput.fill('1');

    await chooseBookableRoom(page);

    const childAge = page.getByLabel(/child 1 age/i);
    await expect(childAge).toBeVisible();
    await childAge.click();
    await childAge.pressSequentially('9');

    await expect(page.getByText(/850(?:\.00)?\s*\/\s*night/i)).toBeVisible();

    const confirmSection = page
      .locator('.mantine-Card-root')
      .filter({ hasText: /Confirm/i })
      .first();

    await expect(confirmSection).toContainText(/Child charges/i);
    await expect(confirmSection).toContainText(/850/);
    await expect(confirmSection).toContainText(/Subtotal/i);
    await expect(confirmSection).toContainText(/4,350/);
    await expect(confirmSection).toContainText(/GST 12%/i);
    await expect(confirmSection).toContainText(/522/);
    await expect(confirmSection).toContainText(/Total payable/i);
    await expect(confirmSection).toContainText(/4,872/);

    await expect(createBooking).toBeEnabled();

    const createReservationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && /\/api\/v1\/.*reservations/.test(response.url()),
    );

    await createBooking.click();

    const reservationResponse = await createReservationResponse;

    expect(
      reservationResponse.ok(),
      `Reservation API failed: ${reservationResponse.status()} ${await reservationResponse.text()}`,
    ).toBeTruthy();

    await expect(page).toHaveURL(/\/reservations\/[^/]+$/);
  });
});
