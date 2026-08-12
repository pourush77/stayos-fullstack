import { expect, type Page } from '@playwright/test';

export const demoPassword = process.env.E2E_PASSWORD ?? 'Password123!';

export async function loginAs(page: Page, email: string) {
  // When E2E tests switch between Front Desk, Maintenance and Housekeeping,
  // explicitly remove the previous browser session first.
  //
  // Without this, navigating to /login while already authenticated can trigger
  // an immediate redirect/re-render and detach the login inputs while Playwright
  // is trying to fill them.
  await page.goto('/');

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.context().clearCookies();

  await page.goto('/login');

  const emailInput = page.getByTestId('login-email');
  const passwordInput = page.getByTestId('login-password');
  const submitButton = page.getByTestId('login-submit');

  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await expect(passwordInput).toBeVisible({ timeout: 15_000 });
  await expect(submitButton).toBeVisible({ timeout: 15_000 });

  await emailInput.fill(email);
  await passwordInput.fill(demoPassword);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 20_000,
    }),
    submitButton.click(),
  ]);

  // Ensure the new user's token has actually been persisted before an API
  // helper executes immediately after loginAs().
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.localStorage.getItem('stayos.accessToken') ??
            window.sessionStorage.getItem('stayos.accessToken'),
        ),
      {
        timeout: 15_000,
        intervals: [200, 500, 1_000],
      },
    )
    .not.toBeNull();

  await page.waitForLoadState('domcontentloaded');
}

export function sidebarItem(page: Page, label: string) {
  return page.getByTestId(`sidebar-nav-${label.toLowerCase().replaceAll(' ', '-')}`);
}

export async function expectSidebarAccess(
  page: Page,
  visibleLabels: string[],
  hiddenLabels: string[],
) {
  for (const label of visibleLabels) {
    await expect(sidebarItem(page, label), `${label} should be visible`).toBeVisible();
  }

  for (const label of hiddenLabels) {
    await expect(sidebarItem(page, label), `${label} should be hidden`).toHaveCount(0);
  }
}
