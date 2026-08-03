import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { openDiscoveredStayWorkspace } from './helpers/stay';

const frontDeskEmail = 'frontdesk@stayos.local';

async function openDepartures(page: Page) {
  await loginAs(page, frontDeskEmail);
  await page.goto('/');
  await page.getByRole('link', { name: /Check Out/ }).click();
  await expect(page).toHaveURL(/\/reservations\?filter=departures-today$/);
  await expect(page.getByRole('heading', { exact: true, name: 'Bookings' })).toBeVisible();
}

test.describe('checkout flow V1 smoke', () => {
  test('front desk checkout card opens departures with operational guidance', async ({ page }) => {
    await openDepartures(page);

    await expect(page.getByText('Guests expected to leave today.')).toBeVisible();
    await expect(page.getByText('Showing checked-in guests departing today.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Front Desk' })).toBeVisible();

    const visibleRows = page.locator('[data-testid^="booking-row-"]');
    const rowCount = await visibleRows.count();
    if (rowCount === 0) {
      await expect(page.getByText('No bookings found')).toBeVisible();
      return;
    }

    await expect(page.locator('[data-testid^="booking-next-action-"]').first()).toContainText('Check Out');
  });

  test('departure next action opens the booking detail checkout context', async ({ page }) => {
    await openDepartures(page);

    const actions = page.locator('[data-testid^="booking-next-action-"]');
    const actionCount = await actions.count();
    test.skip(actionCount === 0, 'No departures due in the current demo data.');

    await actions.first().click();
    await expect(page).toHaveURL(/\/reservations\/[^/]+$/);
    await expect(page.getByText('Back to Front Desk')).toBeVisible();
    await expect(page.getByTestId('booking-next-action-cta')).toContainText(/Check Out|Open Stay/);
  });

  test('stay workspace checkout explains whether to collect payment or confirm checkout', async ({ page }) => {
    await loginAs(page, frontDeskEmail);
    await openDiscoveredStayWorkspace(page);

    await page.getByRole('button', { name: /Check Out|Settle & Check Out/ }).click();
    const modal = page.getByTestId('stay-checkout-modal');
    await expect(modal).toBeVisible();

    const goToBilling = modal.getByRole('button', { name: 'Go to Billing' });
    const confirmCheckout = modal.getByRole('button', { name: 'Check Out' });

    if (await goToBilling.isVisible()) {
      await expect(modal).toContainText('Collect payment from Billing & payments');
      await goToBilling.click();
      await expect(page.getByTestId('payment-amount')).toBeVisible();
      await page.keyboard.press('Escape');
      return;
    }

    await expect(confirmCheckout).toBeVisible();
    await expect(modal).toContainText('The room will be marked for cleaning');
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('checkout modal never exposes final checkout while balance is outstanding', async ({ page }) => {
    await loginAs(page, frontDeskEmail);
    await openDiscoveredStayWorkspace(page);

    await page.getByRole('button', { name: /Check Out|Settle & Check Out/ }).click();
    const modal = page.getByTestId('stay-checkout-modal');
    await expect(modal).toBeVisible();

    if (await modal.getByRole('button', { name: 'Go to Billing' }).isVisible()) {
      await expect(modal.getByRole('button', { name: 'Check Out' })).toHaveCount(0);
    } else {
      await expect(modal.getByRole('button', { name: 'Check Out' })).toBeVisible();
    }
  });
});
