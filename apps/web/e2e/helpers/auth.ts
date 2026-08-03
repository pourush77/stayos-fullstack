import { expect, type Page } from '@playwright/test';

export const demoPassword = process.env.E2E_PASSWORD ?? 'Password123!';

export async function loginAs(page: Page, email: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login');
    await page.evaluate(() => {
      window.localStorage.removeItem('stayos.manualLogout');
      window.sessionStorage.removeItem('stayos.manualLogout');
    });
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(demoPassword);
    await page.getByTestId('login-submit').click();
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await page.waitForTimeout(500);
    }
  }
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
