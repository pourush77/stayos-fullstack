import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';

async function openFrontDesk(page: Parameters<typeof loginAs>[0]) {
  await loginAs(page, frontDeskEmail);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Front Desk' })).toBeVisible();
}

test.describe('front desk V1 smoke flow', () => {
  async function returnToFrontDesk(page: Parameters<typeof loginAs>[0]) {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Front Desk' })).toBeVisible();
  }

  test('quick action cards explain destination and navigate to operational pages', async ({
    page,
  }) => {
    await openFrontDesk(page);

    await expect(page.getByText('Opens booking form')).toBeVisible();
    await expect(page.getByText('Shows assignable rooms')).toBeVisible();
    await expect(page.getByText('Opens group quote')).toBeVisible();
    await expect(page.getByText('Opens calendar')).toBeVisible();
    await expect(page.getByText('Opens guest search')).toBeVisible();
    await expect(page.getByText('Shows due checkouts')).toBeVisible();

    await page.locator('a[href="/reservations/new"]').click();
    await expect(page).toHaveURL(/\/reservations\/new$/);
    await expect(page.getByRole('heading', { name: 'New Booking', exact: true })).toBeVisible();

    await returnToFrontDesk(page);
    await page.locator('a[href="/rooms?mode=assign&status=ready"]').click();
    await expect(page).toHaveURL(/\/rooms\?mode=assign&status=ready$/);
    await expect(page.getByText('Ready rooms for assignment')).toBeVisible();

    await returnToFrontDesk(page);
    await page.locator('a[href="/reservations/group-quote"]').click();
    await expect(page).toHaveURL(/\/reservations\/group-quote$/);
    await expect(page.getByRole('heading', { name: 'Group Quote', exact: true })).toBeVisible();

    await returnToFrontDesk(page);
    await expect(page.locator('a[href="/reservations/availability"]')).toBeVisible();
    await page.locator('a[href="/reservations/availability"]').click();
    await expect(page).toHaveURL(/\/reservations\/availability$/);
    await expect(page.getByRole('heading', { name: /Availability/ })).toBeVisible();

    await returnToFrontDesk(page);
    await page.getByRole('link', { name: /Find Guest/ }).click();
    await expect(page).toHaveURL(/\/guests$/);
    await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible();

    await returnToFrontDesk(page);
    await page.getByRole('link', { name: /Check Out/ }).click();
    await expect(page).toHaveURL(/\/reservations\?filter=departures-today$/);
    await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();
  });

  test('dashboard metric cards route to filtered operational lists', async ({ page }) => {
    await openFrontDesk(page);

    await page.locator('a[href="/reservations?filter=arrivals-today"]').click();
    await expect(page).toHaveURL(/\/reservations\?filter=arrivals-today$/);
    await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();

    await returnToFrontDesk(page);
    await page.locator('a[href="/reservations?filter=checked-in"]').click();
    await expect(page).toHaveURL(/\/reservations\?filter=checked-in$/);
    await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();

    await returnToFrontDesk(page);
    await page.locator('a[href="/rooms?status=needs-cleaning"]').click();
    await expect(page).toHaveURL(/\/rooms\?status=needs-cleaning$/);
    await expect(page.getByRole('heading', { name: 'Rooms', exact: true })).toBeVisible();
  });

  test('assign room opens ready-room view and loads only assignable reservations', async ({
    page,
  }) => {
    await openFrontDesk(page);

    await page.locator('a[href="/rooms?mode=assign&status=ready"]').click();
    await expect(page.getByText('Ready rooms for assignment')).toBeVisible();
    await expect(page.locator('[data-testid^="room-assign-guest-"]').first()).toBeVisible();

    const assignableResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/operations/assignable-reservations') &&
        response.request().method() === 'GET',
    );

    await page.locator('[data-testid^="room-assign-guest-"]').first().click();
    const response = await assignableResponse;
    expect(response.ok()).toBeTruthy();
    expect(response.url()).toContain('roomId=');

    const modal = page.getByTestId('assign-guest-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('assign-guest-search')).toBeVisible();

    await expect(modal.getByText('This booking already has a room assigned.')).toHaveCount(0);
    await expect(modal.getByText('This booking stay date has already passed.')).toHaveCount(0);
    await expect(modal.getByText('Unavailable')).toHaveCount(0);
  });

  test('assign guest modal supports guest or confirmation search', async ({ page }) => {
    await openFrontDesk(page);
    await page.goto('/rooms?mode=assign&status=ready');
    await expect(page.locator('[data-testid^="room-assign-guest-"]').first()).toBeVisible();

    await page.locator('[data-testid^="room-assign-guest-"]').first().click();
    await expect(page.getByTestId('assign-guest-modal')).toBeVisible();

    const visibleReservation = page.locator('[data-testid^="assignable-reservation-"]').first();
    const reservationCount = await page.locator('[data-testid^="assignable-reservation-"]').count();

    if (reservationCount === 0) {
      await expect(
        page.getByText('No reservations are currently eligible for assignment to this room.'),
      ).toBeVisible();
      return;
    }

    const firstReservationText = (await visibleReservation.innerText()).trim();
    const searchTerm = firstReservationText.split(/\s+/)[0] ?? '';

    await page.getByTestId('assign-guest-search').fill(searchTerm);
    await expect(page.locator('[data-testid^="assignable-reservation-"]').first()).toContainText(
      searchTerm,
    );

    await page.getByTestId('assign-guest-search').fill('zzzz-no-reservation-match');
    await expect(page.getByText('No eligible reservations match this search.')).toBeVisible();
  });
});
