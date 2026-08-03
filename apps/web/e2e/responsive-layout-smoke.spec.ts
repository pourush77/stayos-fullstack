import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { openDiscoveredCheckInWorkspace } from './helpers/check-in';

const frontDeskEmail = 'frontdesk@stayos.local';

const staffViewports = [
  { name: 'small laptop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
];

async function expectNoBodyHorizontalOverflow(page: Page, tolerance = 16) {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return {
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.rootScrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.clientWidth + tolerance,
  );
  expect(metrics.bodyScrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.viewportWidth + tolerance,
  );
}

async function expectLocatorWithinViewport(locator: Locator, page: Page, tolerance = 8) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box, 'Expected locator to have a visible bounding box').toBeTruthy();
  expect(viewport, 'Expected viewport size to be available').toBeTruthy();

  expect(box!.x, JSON.stringify({ box, viewport })).toBeGreaterThanOrEqual(-tolerance);
  expect(box!.x + box!.width, JSON.stringify({ box, viewport })).toBeLessThanOrEqual(
    viewport!.width + tolerance,
  );
}

test.describe('responsive V1 layout smoke', () => {
  for (const viewport of staffViewports) {
    test(`front desk quick actions and metrics stay usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAs(page, frontDeskEmail);

      await expect(page.getByRole('heading', { name: 'Front Desk' })).toBeVisible();
      await expect(page.locator('a[href="/reservations/new"]')).toBeVisible();
      await expect(page.locator('a[href="/rooms?mode=assign&status=ready"]').first()).toBeVisible();
      await expect(page.locator('a[href="/reservations/group-quote"]')).toBeVisible();
      await expect(page.locator('a[href="/reservations/availability"]')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Find Guest Profile or stay' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Check Out Departures due Shows due checkouts' })).toBeVisible();
      await expect(page.getByText(/Arrivals Today/)).toBeVisible();
      await expect(page.getByText(/Departures Today/)).toBeVisible();
      await expect(page.getByText(/Guests In House/)).toBeVisible();
      await expect(page.getByText(/Rooms To Clean/)).toBeVisible();

      await expectNoBodyHorizontalOverflow(page);
    });
  }

  for (const viewport of staffViewports) {
    test(`assign guest modal remains usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAs(page, frontDeskEmail);
      await page.goto('/rooms?mode=assign&status=ready');

      await expect(page.getByText('Ready rooms for assignment')).toBeVisible();
      await expect(page.locator('[data-testid^="room-assign-guest-"]').first()).toBeVisible();

      await page.locator('[data-testid^="room-assign-guest-"]').first().click();

      const modal = page.getByTestId('assign-guest-modal');
      await expectLocatorWithinViewport(modal, page, 12);
      await expect(page.getByTestId('assign-guest-search')).toBeVisible();

      await expect(
        page
          .locator('[data-testid^="assignable-reservation-"]')
          .first()
          .or(page.getByText('No reservations are currently eligible for assignment to this room.')),
      ).toBeVisible();
    });
  }

  for (const viewport of staffViewports) {
    test(`availability planning view avoids page overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAs(page, frontDeskEmail);
      await page.goto('/reservations/availability');

      await expect(page.getByRole('heading', { exact: true, name: 'Availability Calendar' })).toBeVisible();
      await expect(page.getByRole('link', { exact: true, name: 'Group / Block' })).toBeVisible();
      await expect(page.getByRole('link', { exact: true, name: 'New Booking' })).toBeVisible();
      await expect(page.getByText('Sellable room types')).toBeVisible();
      await expect(page.getByText('AVAILABLE').first()).toBeVisible();

      await expectNoBodyHorizontalOverflow(page, 24);
    });
  }

  for (const viewport of staffViewports) {
    test(`check-in wizard stays readable and actionable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAs(page, frontDeskEmail);
      await openDiscoveredCheckInWorkspace(page);

      await expect(page.getByTestId('checkin-workspace-page')).toBeVisible();
      await expect(page.getByTestId('checkin-summary-card')).toBeVisible();
      await expect(page.getByTestId('checkin-layout')).toBeVisible();
      await expect(page.getByTestId('checkin-wizard-nav')).toBeVisible();
      await expect(page.getByTestId('checkin-main')).toBeVisible();
      await expect(page.getByTestId('checkin-save-identity')).toBeVisible();
      await expect(page.getByTestId('id-photo-tile-front')).toBeVisible();
      await expect(page.getByTestId('face-match-card')).toBeVisible();

      await page.getByTestId('checkin-sticky-footer').scrollIntoViewIfNeeded();
      await expectLocatorWithinViewport(page.getByTestId('checkin-sticky-footer'), page, 12);

      await page.getByTestId('checkin-wizard-nav').getByRole('button', { name: /Guest details/ }).click();
      await expect(page.getByTestId('checkin-save-guest')).toBeVisible();
      await expect(page.getByText('Step 2 - Guest details')).toBeVisible();

      await expectNoBodyHorizontalOverflow(page, 24);
    });
  }
});
