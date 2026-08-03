import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';

async function openAvailability(page: Page) {
  await loginAs(page, frontDeskEmail);
  await page.goto('/reservations/availability');
  await expect(page.getByRole('heading', { exact: true, name: 'Availability Calendar' })).toBeVisible();
}

async function openGroupQuote(page: Page) {
  await loginAs(page, frontDeskEmail);
  await page.goto('/reservations/group-quote');
  await expect(page.getByRole('heading', { exact: true, name: 'Group Quote' })).toBeVisible();
}

test.describe('availability and group flow smoke', () => {
  test('availability calendar renders planning controls and sellable grid', async ({ page }) => {
    await openAvailability(page);

    await expect(page.getByRole('link', { name: /Available tonight/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ready rooms/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Group holds/ })).toBeVisible();
    await expect(page.getByRole('link', { exact: true, name: 'Group / Block' })).toBeVisible();
    await expect(page.getByRole('link', { exact: true, name: 'New Booking' })).toBeVisible();
    await expect(page.getByText('Sellable room types')).toBeVisible();
    await expect(page.getByText('Click an empty cell to start a booking for that room and date.')).toBeVisible();
    await expect(page.getByText('AVAILABLE').first()).toBeVisible();
    await expect(page.locator('[data-testid^="calendar-empty-"]').first()).toBeVisible();
  });

  test('availability quick actions navigate to operational destinations', async ({ page }) => {
    await openAvailability(page);

    await page.getByRole('link', { exact: true, name: 'Group / Block' }).click();
    await expect(page).toHaveURL(/\/reservations\/group-quote$/);
    await expect(page.getByRole('heading', { exact: true, name: 'Group Quote' })).toBeVisible();

    await page.goto('/reservations/availability');
    await page.getByRole('link', { exact: true, name: 'New Booking' }).click();
    await expect(page).toHaveURL(/\/reservations\/new$/);
    await expect(page.getByRole('heading', { exact: true, name: 'New Booking' })).toBeVisible();

    await page.goto('/reservations/availability');
    await page.getByRole('link', { name: /Ready rooms/ }).click();
    await expect(page).toHaveURL(/\/rooms\?mode=assign&status=ready$/);
    await expect(page.getByText('Ready rooms for assignment')).toBeVisible();
  });

  test('availability empty calendar cell starts a prefilled booking', async ({ page }) => {
    await openAvailability(page);

    await page.locator('[data-testid^="calendar-empty-"]').first().click();
    await expect(page).toHaveURL(/\/reservations\/new\?/);
    await expect(page).toHaveURL(/arrivalDate=/);
    await expect(page).toHaveURL(/departureDate=/);
    await expect(page).toHaveURL(/preferredRoomId=/);
    await expect(page.getByRole('heading', { exact: true, name: 'New Booking' })).toBeVisible();
  });

  test('availability group hold cells identify the hold and open its detail page', async ({ page }) => {
    await openAvailability(page);

    const holdCells = page.locator('[data-testid^="calendar-hold-"]');
    const holdCount = await holdCells.count();
    test.skip(holdCount === 0, 'No visible group holds in the current demo calendar range.');

    const holdCell = holdCells.first();
    await expect(holdCell).toHaveAttribute('title', /.+/);
    await holdCell.click();
    await expect(page).toHaveURL(/\/reservations\/group-holds\//);
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  test('group quote separates saved holds from room mix suggestions', async ({ page }) => {
    await openGroupQuote(page);

    await expect(page.getByRole('link', { exact: true, name: 'Single-room quote' })).toBeVisible();
    await expect(page.getByLabel('Stay dates')).toBeVisible();
    await expect(page.getByLabel('Adults')).toBeVisible();
    await expect(page.getByLabel('Children')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Preference' })).toBeVisible();
    await expect(page.getByTestId('group-quote-find-room-mix')).toBeVisible();
    await expect(page.getByRole('heading', { exact: true, name: 'Saved Holds' })).toBeVisible();
    await expect(page.getByRole('heading', { exact: true, name: 'Room Mix Suggestions' })).toBeVisible();
    await expect(
      page.getByText('Ready to quote a group').or(page.getByRole('heading', { exact: true, name: 'Availability' })),
    ).toBeVisible();

    await page.getByRole('link', { exact: true, name: 'Single-room quote' }).click();
    await expect(page).toHaveURL(/\/reservations\/quote$/);
  });

  test('group quote can generate suggestions and open the create-hold modal without saving', async ({
    page,
  }) => {
    await openGroupQuote(page);

    await page.getByTestId('group-quote-find-room-mix').click();
    await expect(page.getByRole('heading', { exact: true, name: 'Availability' })).toBeVisible();

    const createHoldButtons = page.getByTestId('group-quote-create-hold');
    const optionCount = await createHoldButtons.count();
    test.skip(optionCount === 0, 'No feasible room mix options in the current demo data.');

    await createHoldButtons.first().click();
    await expect(page.getByText('Create Group Hold')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Create Group Hold')).toHaveCount(0);
  });

  test('saved group hold cards open the hold detail page', async ({ page }) => {
    await openGroupQuote(page);

    const holdCards = page.locator('[data-testid^="group-hold-card-"]');
    const holdCount = await holdCards.count();
    test.skip(holdCount === 0, 'No saved group holds in the current demo data.');

    await holdCards.first().click();
    await expect(page).toHaveURL(/\/reservations\/group-holds\//);
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });
});
