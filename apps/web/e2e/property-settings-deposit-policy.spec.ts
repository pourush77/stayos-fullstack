import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const PROPERTY_ID = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';

const baseProperty = {
  id: PROPERTY_ID,
  code: 'STAYOS-BLR-001',
  name: 'StayOS Bengaluru Central',
  legalName: 'StayOS Hospitality Private Limited',
  gstNumber: '29ABCDE1234F1Z5',
  panNumber: null,
  cinNumber: null,
  logoUrl: null,
  email: 'frontdesk.blr@stayos.com',
  phone: '+918012345678',
  website: null,
  addressLine1: '12 Residency Road',
  addressLine2: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  stateCode: '29',
  country: 'India',
  postalCode: '560001',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  totalFloors: 6,
  totalRooms: 120,
  status: 'ACTIVE',
  groupBookingDepositPolicyType: 'NONE',
  groupBookingDepositPolicyValue: null,
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
};

async function mockPropertySettingsApi(page: Page) {
  await page.route('**/api/v1/properties', async (route, request) => {
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        success: true,
        message: 'Records fetched successfully.',
        data: [baseProperty],
      }),
    });
  });

  await page.route(`**/api/v1/properties/${PROPERTY_ID}`, async (route, request) => {
    if (request.method() !== 'PATCH') {
      await route.continue();
      return;
    }

    const payload = request.postDataJSON() as {
      groupBookingDepositPolicyType?: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
      groupBookingDepositPolicyValue?: number;
    };

    const updatedProperty = {
      ...baseProperty,
      groupBookingDepositPolicyType:
        payload.groupBookingDepositPolicyType ?? baseProperty.groupBookingDepositPolicyType,
      groupBookingDepositPolicyValue:
        payload.groupBookingDepositPolicyType === 'NONE'
          ? null
          : (payload.groupBookingDepositPolicyValue ?? null),
    };

    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        success: true,
        message: 'Operation completed successfully.',
        data: updatedProperty,
      }),
    });
  });
}

test.describe('Property settings deposit policy', () => {
  test('loads property settings without showing a false error banner', async ({ page }) => {
    await loginAs(page, 'manager@stayos.local');
    await mockPropertySettingsApi(page);

    const loadResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/v1\/properties(?:\?|$)/.test(response.url()),
    );

    await page.goto('/settings/property');

    const loadResponse = await loadResponsePromise;
    expect(loadResponse.ok(), `Properties load failed: ${loadResponse.status()}`).toBeTruthy();

    await expect(page.getByTestId('property-settings')).toBeVisible();
    await expect(
      page.getByText('We could not load property settings. Please try again.', { exact: true }),
    ).toHaveCount(0);
  });

  test('saves FIXED_AMOUNT and NONE payloads with expected API shape', async ({ page }) => {
    await loginAs(page, 'manager@stayos.local');
    await mockPropertySettingsApi(page);
    await page.goto('/settings/property');
    await expect(page.getByTestId('property-settings')).toBeVisible();

    const policySelect = page.getByRole('combobox', { name: 'Deposit policy' });

    await policySelect.click();
    await page.getByRole('option', { name: 'Fixed amount', exact: true }).click();
    await page.getByLabel('Deposit required', { exact: true }).fill('5000');

    const fixedPatchPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/v1\/properties\/[0-9a-f-]+$/i.test(response.url()),
    );

    await page.getByRole('button', { name: /save policy/i }).click();
    const fixedPatchResponse = await fixedPatchPromise;

    expect(
      fixedPatchResponse.ok(),
      `Fixed amount save failed: ${fixedPatchResponse.status()} ${await fixedPatchResponse.text()}`,
    ).toBeTruthy();

    const fixedPayload = fixedPatchResponse.request().postDataJSON() as {
      groupBookingDepositPolicyType?: string;
      groupBookingDepositPolicyValue?: number;
    };
    expect(fixedPayload.groupBookingDepositPolicyType).toBe('FIXED_AMOUNT');
    expect(fixedPayload.groupBookingDepositPolicyValue).toBe(5000);

    await policySelect.click();
    await page.getByRole('option', { name: 'No deposit required', exact: true }).click();

    const nonePatchPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/v1\/properties\/[0-9a-f-]+$/i.test(response.url()),
    );

    await page.getByRole('button', { name: /save policy/i }).click();
    const nonePatchResponse = await nonePatchPromise;

    expect(
      nonePatchResponse.ok(),
      `NONE save failed: ${nonePatchResponse.status()} ${await nonePatchResponse.text()}`,
    ).toBeTruthy();

    const nonePayload = nonePatchResponse.request().postDataJSON() as {
      groupBookingDepositPolicyType?: string;
      groupBookingDepositPolicyValue?: number;
    };
    expect(nonePayload.groupBookingDepositPolicyType).toBe('NONE');
    expect(nonePayload).not.toHaveProperty('groupBookingDepositPolicyValue');
  });
});
