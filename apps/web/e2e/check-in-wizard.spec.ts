import { expect, test } from '@playwright/test';
import { openDiscoveredCheckInWorkspace } from './helpers/check-in';
import { loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';

async function openWizard(page: Parameters<typeof loginAs>[0]) {
  await loginAs(page, frontDeskEmail);
  await openDiscoveredCheckInWorkspace(page);
}

test.describe('check-in wizard V1 validation', () => {
  test('loads the workspace with readable summary and wizard navigation', async ({ page }) => {
    await openWizard(page);

    await expect(page.getByText('Check-in', { exact: true })).toBeVisible();
    await expect(page.getByTestId('checkin-wizard-nav')).toBeVisible();
    await expect(page.getByRole('button', { name: /Identity/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Guest details/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Payment/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Room/ })).toBeVisible();
    await expect(page.getByTestId('checkin-save-identity')).toBeVisible();
  });

  test('Aadhaar input accepts only 12 digits and requires physical verification', async ({
    page,
  }) => {
    await openWizard(page);

    const idNumber = page.getByTestId('checkin-id-number');
    const saveIdentity = page.getByTestId('checkin-save-identity');

    await idNumber.fill('123123123123999999abc');
    await expect(idNumber).toHaveValue('123123123123');
    await expect(saveIdentity).toBeDisabled();

    await idNumber.fill('12345');
    await expect(idNumber).toHaveValue('12345');
    await expect(saveIdentity).toBeDisabled();

    await idNumber.fill('123456789012');
    await expect(idNumber).toHaveValue('123456789012');
    await expect(saveIdentity).toBeDisabled();

    await page.getByTestId('checkin-id-verified').click();
    await expect(saveIdentity).toBeEnabled();
  });

  test('optional camera can be skipped without blocking local identity form readiness', async ({
    page,
  }) => {
    await openWizard(page);

    await expect(page.getByTestId('face-match-card')).toBeVisible();
    await page.getByRole('button', { name: 'Skip camera for now' }).click();
    await expect(page.getByText('Face snap skipped for now.')).toBeVisible();

    await page.getByTestId('checkin-id-number').fill('123456789012');
    await page.getByTestId('checkin-id-verified').click();
    await expect(page.getByTestId('checkin-save-identity')).toBeEnabled();
  });

  test('guest details defaults to missing-fields-first with editable full details', async ({
    page,
  }) => {
    await openWizard(page);

    await page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Guest details/ }).click();
    await expect(page.getByText('Step 2 - Guest details')).toBeVisible();
    await expect(page.getByText('Finish these first')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Show all details' })).toBeVisible();

    await page.getByRole('button', { name: 'Show all details' }).click();
    await expect(page.getByText('Registration details')).toBeVisible();
    await expect(page.getByTestId('checkin-nationality')).toHaveValue(/INDIAN|Indian/);
    await expect(page.getByTestId('checkin-full-name')).toBeVisible();
    await expect(page.getByTestId('checkin-mobile')).toBeVisible();
  });

  test('footer CTA changes as receptionist moves through steps', async ({ page }) => {
    await openWizard(page);

    await expect(page.getByTestId('checkin-save-identity')).toContainText('Save identity');

    await page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Guest details/ }).click();
    await expect(page.getByTestId('checkin-save-guest')).toContainText(/Save .*guest detail/);

    await page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Payment/ }).click();
    await expect(page.getByTestId('checkin-save-payment')).toContainText('Mark payment reviewed');

    await page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Room/ }).click();
    await expect(
      page.getByTestId('checkin-complete').or(page.getByTestId('checkin-open-rooms')),
    ).toBeVisible();
  });
});
