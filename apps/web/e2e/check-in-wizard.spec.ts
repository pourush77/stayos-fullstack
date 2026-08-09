import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { openDiscoveredCheckInWorkspace } from './helpers/check-in';

const frontDeskEmail = 'frontdesk@stayos.local';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

async function clickWizardStep(page: Page, name: RegExp) {
  await page.getByTestId('checkin-wizard-nav').getByRole('button', { name }).click();
}

async function fillIfEmpty(page: Page, testId: string, value: string) {
  const field = page.getByTestId(testId);
  if (!(await field.isVisible().catch(() => false))) return;

  const current = await field.inputValue().catch(() => '');
  if (!current.trim()) await field.fill(value);
}

async function chooseMantineSelectIfEmpty(page: Page, testId: string, optionName: string) {
  const select = page.getByTestId(testId);
  if (!(await select.isVisible().catch(() => false))) return;

  const current = await select.inputValue().catch(() => '');
  if (current.trim()) return;

  await select.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function completeIdentity(page: Page) {
  await clickWizardStep(page, /Identity/i);
  await expect(page.getByText('Step 1 - Verify identity')).toBeVisible();

  const save = page.getByTestId('checkin-save-identity');
  const idType = page.getByTestId('checkin-id-type');
  const idNumber = page.getByTestId('checkin-id-number');
  const verified = page.getByTestId('checkin-id-verified');

  async function prepareIdentity(type: 'AADHAAR' | 'PASSPORT', number: string) {
    await idType.click();
    await page
      .getByRole('option', {
        name: type === 'AADHAAR' ? 'Aadhaar' : 'Passport',
        exact: true,
      })
      .click();

    await idNumber.fill(number);

    if (!(await verified.isChecked().catch(() => false))) {
      await verified.check();
    }

    await expect(save).toBeEnabled({
      timeout: 10_000,
    });
  }

  async function submitIdentity() {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/properties\/[^/]+\/reservations\/[^/]+\/check-in\/identity(?:\?|$)/.test(response.url()),
      {
        timeout: 20_000,
      },
    );

    await save.click();
    return responsePromise;
  }

  // Start with the normal Indian guest path.
  await prepareIdentity('AADHAAR', '123456789012');

  let response = await submitIdentity();

  if (!response.ok()) {
    const body = await response.text();

    // openDiscoveredCheckInWorkspace() may discover a foreign guest.
    // The backend correctly requires passport verification in that case,
    // so retry the identity step using Passport rather than failing the suite.
    if (
      response.status() === 400 &&
      body.includes('Foreign guests require passport identity verification')
    ) {
      await prepareIdentity('PASSPORT', 'A1234567');
      response = await submitIdentity();

      if (!response.ok()) {
        const retryBody = await response.text();

        throw new Error(
          `Passport identity verification failed: ${response.status()} ${response.statusText()}\n${retryBody}`,
        );
      }
    } else {
      throw new Error(
        `Identity verification failed: ${response.status()} ${response.statusText()}\n${body}`,
      );
    }
  }

  await expect(
    page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Identity/i }),
  ).toContainText(/Ready|Saved/i, {
    timeout: 15_000,
  });
}

async function completeGuestRegistration(page: Page) {
  await clickWizardStep(page, /Guest details/i);
  await expect(page.getByText('Step 2 - Guest details')).toBeVisible();

  // The page intentionally shows missing required fields first. Fill whichever
  // ones are currently rendered, then expose the complete form and fill any
  // remaining required values that are blank.
  await fillIfEmpty(page, 'checkin-full-name', `E2E Checkin ${Date.now()}`);
  await fillIfEmpty(page, 'checkin-mobile', '9876543210');
  await fillIfEmpty(page, 'checkin-address', '101 StayOS Test Street');
  await fillIfEmpty(page, 'checkin-city', 'Indore');

  await chooseMantineSelectIfEmpty(page, 'checkin-country', 'India');
  await chooseMantineSelectIfEmpty(page, 'checkin-state', 'Madhya Pradesh');
  await chooseMantineSelectIfEmpty(page, 'checkin-nationality', 'Indian');
  await chooseMantineSelectIfEmpty(page, 'checkin-purpose', 'Leisure');

  const showAll = page.getByRole('button', { name: 'Show all details' });
  if (await showAll.isVisible().catch(() => false)) {
    await showAll.click();
  }

  await fillIfEmpty(page, 'checkin-full-name', `E2E Checkin ${Date.now()}`);
  await fillIfEmpty(page, 'checkin-mobile', '9876543210');
  await fillIfEmpty(page, 'checkin-address', '101 StayOS Test Street');
  await fillIfEmpty(page, 'checkin-city', 'Indore');

  await chooseMantineSelectIfEmpty(page, 'checkin-country', 'India');
  await chooseMantineSelectIfEmpty(page, 'checkin-state', 'Madhya Pradesh');
  await chooseMantineSelectIfEmpty(page, 'checkin-nationality', 'Indian');
  await chooseMantineSelectIfEmpty(page, 'checkin-purpose', 'Leisure');

  const save = page.getByTestId('checkin-save-guest');
  await expect(save).toBeVisible();

  const guestResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/properties\/[^/]+\/reservations\/[^/]+\/check-in\/guest-registration(?:\?|$)/.test(
        response.url(),
      ),
  );

  await save.click();
  const response = await guestResponse;

  if (!response.ok()) {
    const body = await response.text();

    throw new Error(
      `Guest registration failed: ${response.status()} ${response.statusText()}\n${body}`,
    );
  }

  await expect(
    page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Guest details/i }),
  ).toContainText(/Ready|Saved/i, { timeout: 15_000 });
}

async function reviewPayment(page: Page) {
  await clickWizardStep(page, /Payment/i);
  await expect(page.getByText('Step 3 - Payment plan')).toBeVisible();

  await page.getByTestId('payment-chip-CASH').click();

  const save = page.getByTestId('checkin-save-payment');
  await expect(save).toBeVisible();

  const paymentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/properties\/[^/]+\/reservations\/[^/]+\/check-in\/payment-review(?:\?|$)/.test(
        response.url(),
      ),
  );

  await save.click();
  const response = await paymentResponse;

  if (!response.ok()) {
    const body = await response.text();

    throw new Error(
      `Payment review failed: ${response.status()} ${response.statusText()}\n${body}`,
    );
  }

  await expect(
    page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Payment/i }),
  ).toContainText(/Ready|Saved/i, { timeout: 15_000 });
}

async function verifyRoomReady(page: Page) {
  await clickWizardStep(page, /Room/i);
  await expect(page.getByText('Step 4 - Room readiness')).toBeVisible();

  const openRooms = page.getByTestId('checkin-open-rooms');
  if (await openRooms.isVisible().catch(() => false)) {
    throw new Error(
      'The discovered reservation does not have an assigned READY room. ' +
        'Use/adjust openDiscoveredCheckInWorkspace() so it selects a confirmed booking with a ready assigned room.',
    );
  }

  await expect(page.getByTestId('checkin-complete')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('checkin-complete')).toBeEnabled();
}

async function completeCheckIn(page: Page) {
  const complete = page.getByTestId('checkin-complete');

  const checkInResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/properties\/[^/]+\/reservations\/[^/]+\/check-in(?:\?|$)/.test(response.url()),
  );

  await complete.click();
  const response = await checkInResponse;

  if (!response.ok()) {
    const body = await response.text();

    throw new Error(
      `Complete check-in failed: ${response.status()} ${response.statusText()}\n${body}`,
    );
  }

  await expect(page).toHaveURL(/\/guest-stay\/[^/?#]+(?:[?#].*)?$/, {
    timeout: 20_000,
  });
}

test.describe('check-in lifecycle - pre Channel Manager readiness', () => {
  test.setTimeout(120_000);

  test('complete receptionist check-in workflow and open Stay Workspace', async ({ page }) => {
    await test.step('login and discover an eligible check-in workspace', async () => {
      await loginAs(page, frontDeskEmail);
      await openDiscoveredCheckInWorkspace(page);

      await expect(page.getByTestId('checkin-workspace-page')).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId('checkin-wizard-nav')).toBeVisible();
    });

    await test.step('verify guest identity', async () => {
      await completeIdentity(page);
    });

    await test.step('complete guest registration', async () => {
      await completeGuestRegistration(page);
    });

    await test.step('review payment plan', async () => {
      await reviewPayment(page);
    });

    await test.step('verify assigned room is ready', async () => {
      await verifyRoomReady(page);
    });

    await test.step('complete check-in and open Stay Workspace', async () => {
      await completeCheckIn(page);
    });
  });
});
