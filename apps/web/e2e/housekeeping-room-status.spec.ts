import { expect, test, type Page } from '@playwright/test';
import { expectSidebarAccess, loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';
const housekeepingEmail = 'housekeeping@stayos.local';

async function openHousekeeping(page: Page) {
  await loginAs(page, housekeepingEmail);
  await expect(page).toHaveURL(/\/housekeeping$/);
  await expect(page.getByTestId('housekeeping-page')).toBeVisible();
}

test.describe('housekeeping and room status V1 smoke', () => {
  test('housekeeping role lands on a focused cleaning workspace', async ({ page }) => {
    await openHousekeeping(page);

    await expectSidebarAccess(
      page,
      ['Housekeeping'],
      ['Front Desk', 'Bookings', 'Rooms', 'Guests', 'Maintenance', 'Employees', 'Billing', 'Reports'],
    );
    await expect(
      page.getByTestId('housekeeping-page').getByRole('heading', { exact: true, name: 'Housekeeping' }),
    ).toBeVisible();
    await expect(page.getByText('Assign rooms, track cleaning, and inspect rooms before release.')).toBeVisible();
    await expect(page.getByTestId('housekeeping-summary-dirty')).toBeVisible();
    await expect(page.getByTestId('housekeeping-summary-cleaning')).toBeVisible();
    await expect(page.getByTestId('housekeeping-summary-inspection')).toBeVisible();
    await expect(page.getByRole('heading', { exact: true, name: 'Room Workflow' })).toBeVisible();
  });

  test('housekeeping page supports operational search and status filters', async ({ page }) => {
    await openHousekeeping(page);

    await expect(page.getByTestId('housekeeping-search')).toBeVisible();
    await expect(page.getByTestId('housekeeping-floor-filter')).toBeVisible();
    await expect(page.getByTestId('housekeeping-status-filter')).toBeVisible();
    await expect(page.getByTestId('housekeeping-staff-filter')).toBeVisible();

    await page.getByTestId('housekeeping-search').fill('no-room-should-match-this');
    await expect(page.getByText('No rooms match "no-room-should-match-this".')).toBeVisible();
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect(page.getByText('No rooms match "no-room-should-match-this".')).toHaveCount(0);
  });

  test('front desk rooms-to-clean card opens needs-cleaning room board', async ({ page }) => {
    await loginAs(page, frontDeskEmail);
    await page.goto('/');

    await page.locator('a[href="/rooms?status=needs-cleaning"]').click();
    await expect(page).toHaveURL(/\/rooms\?status=needs-cleaning$/);
    await expect(page.getByRole('heading', { exact: true, name: 'Rooms' })).toBeVisible();
    await expect(page.getByText('Cleaning or inspection.')).toBeVisible();

    const assignButtons = page.locator('[data-testid^="room-assign-guest-"]');
    await expect(assignButtons).toHaveCount(0);
  });

  test('ready-room assignment view excludes housekeeping rooms', async ({ page }) => {
    await loginAs(page, frontDeskEmail);
    await page.goto('/rooms?mode=assign&status=ready');

    await expect(page.getByText('Ready rooms for assignment')).toBeVisible();
    await expect(page.getByTestId('room-status-filter')).toHaveValue('Ready to Assign');

    const cards = page.locator('[data-testid^="room-card-"]');
    const cardCount = await cards.count();
    test.skip(cardCount === 0, 'No ready rooms available in the current demo data.');

    await expect(page.getByText('Waiting for housekeeping')).toHaveCount(0);
    await expect(page.getByText('Cleaning in progress')).toHaveCount(0);
  });

  test('housekeeping room action opens a safe confirmation boundary', async ({ page }) => {
    await openHousekeeping(page);

    const assignButtons = page.locator('[data-testid^="housekeeping-assign-"]');
    const completeButtons = page.locator('[data-testid^="housekeeping-complete-"]');
    const inspectButtons = page.locator('[data-testid^="housekeeping-inspect-"]');

    if ((await assignButtons.count()) > 0) {
      await assignButtons.first().click();
      await expect(page.getByTestId('housekeeping-assign-modal')).toBeVisible();
      await expect(page.getByText('Housekeeping staff')).toBeVisible();
      await page.keyboard.press('Escape');
      return;
    }

    if ((await completeButtons.count()) > 0) {
      await completeButtons.first().click();
      await expect(page.getByTestId('housekeeping-complete-modal')).toBeVisible();
      await expect(page.getByTestId('housekeeping-mark-all-done')).toBeVisible();
      await page.keyboard.press('Escape');
      return;
    }

    if ((await inspectButtons.count()) > 0) {
      await inspectButtons.first().click();
      await expect(page.getByTestId('housekeeping-inspect-modal')).toBeVisible();
      await expect(page.getByTestId('inspect-mark-all')).toBeVisible();
      await page.keyboard.press('Escape');
      return;
    }

    await expect(page.getByText(/No rooms need cleaning|No rooms in progress|No rooms waiting inspection/)).toBeVisible();
  });
});
