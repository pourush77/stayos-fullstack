import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { openDiscoveredStayWorkspace } from './helpers/stay';

const frontDeskEmail = 'frontdesk@stayos.local';

async function openStay(page: Parameters<typeof loginAs>[0]) {
  await loginAs(page, frontDeskEmail);
  await openDiscoveredStayWorkspace(page);
}

test.describe('stay workspace billing V1 smoke', () => {
  test('checked-in stay opens with operational header and billing panel', async ({ page }) => {
    await openStay(page);

    await expect(page.getByText('Back to Front Desk')).toBeVisible();
    await expect(page.getByText('What Needs Attention')).toBeVisible();
    await expect(page.getByText('Guest service')).toBeVisible();
    await expect(page.getByText('Billing & payments')).toBeVisible();
    await expect(page.locator('[data-testid^="folio-panel-"]').first()).toBeVisible();
  });

  test('folio actions are available without mutating billing data', async ({ page }) => {
    await openStay(page);

    await expect(page.getByTestId('folio-add-charge')).toBeVisible();
    await expect(page.getByTestId('folio-collect-payment')).toBeVisible();

    await page.getByTestId('folio-add-charge').click();
    await expect(page.getByTestId('charge-description')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('folio-collect-payment').click();
    await expect(page.getByTestId('payment-amount')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('checkout opens clear next-step guidance without confirming checkout', async ({ page }) => {
    await openStay(page);

    await page.getByRole('button', { name: /Check Out|Settle & Check Out/ }).click();
    await expect(page.getByTestId('stay-checkout-modal')).toBeVisible();

    const modal = page.getByTestId('stay-checkout-modal');
    await expect(
      modal.getByText(/Collect payment from Billing & payments|Confirm checkout/),
    ).toBeVisible();
    await expect(modal.getByRole('button', { name: /Go to Billing|Check Out/ })).toBeVisible();

    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('stay-checkout-modal')).toHaveCount(0);
  });

  test('stay quick facts and document sections are visible for front desk review', async ({
    page,
  }) => {
    await openStay(page);

    await expect(page.getByText('Guest & room quick facts')).toBeVisible();
    await expect(page.getByText('Documents')).toBeVisible();
    await expect(page.getByTestId('view-full-guest-profile')).toBeVisible();
  });
});
