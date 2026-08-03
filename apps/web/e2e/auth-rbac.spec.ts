import { expect, test } from '@playwright/test';
import { expectSidebarAccess, loginAs } from './helpers/auth';

const demoAccounts = [
  {
    role: 'Front Desk',
    email: 'frontdesk@stayos.local',
    landingPath: '/',
    visible: ['Front Desk', 'Bookings', 'Rooms', 'Guests', 'Housekeeping', 'Maintenance'],
    hidden: ['Employees', 'Billing', 'Reports'],
  },
  {
    role: 'Manager',
    email: 'manager@stayos.local',
    landingPath: '/',
    visible: [
      'Front Desk',
      'Bookings',
      'Rooms',
      'Guests',
      'Housekeeping',
      'Maintenance',
      'Employees',
      'Billing',
      'Reports',
    ],
    hidden: [],
  },
  {
    role: 'Housekeeping',
    email: 'housekeeping@stayos.local',
    landingPath: '/housekeeping',
    visible: ['Housekeeping'],
    hidden: [
      'Front Desk',
      'Bookings',
      'Rooms',
      'Guests',
      'Maintenance',
      'Employees',
      'Billing',
      'Reports',
    ],
  },
  {
    role: 'Maintenance',
    email: 'maintenance@stayos.local',
    landingPath: '/maintenance',
    visible: ['Rooms', 'Maintenance'],
    hidden: ['Front Desk', 'Bookings', 'Guests', 'Housekeeping', 'Employees', 'Billing', 'Reports'],
  },
  {
    role: 'Accounts',
    email: 'accounts@stayos.local',
    landingPath: '/billing',
    visible: ['Bookings', 'Guests', 'Billing', 'Reports'],
    hidden: ['Front Desk', 'Rooms', 'Housekeeping', 'Maintenance', 'Employees'],
  },
];

test.describe('demo account RBAC smoke test', () => {
  for (const account of demoAccounts) {
    test(`${account.role} lands on the right page and sees only allowed navigation`, async ({
      page,
    }) => {
      await loginAs(page, account.email);
      await expect(page).toHaveURL(new RegExp(`${account.landingPath.replace('/', '\\/')}$`));
      await expectSidebarAccess(page, account.visible, account.hidden);
    });
  }
});

const deniedRoutes = [
  {
    role: 'Front Desk',
    email: 'frontdesk@stayos.local',
    redirectPath: '/',
    routes: ['/billing', '/settings', '/settings/employees', '/reports'],
  },
  {
    role: 'Housekeeping',
    email: 'housekeeping@stayos.local',
    redirectPath: '/housekeeping',
    routes: ['/rooms', '/reservations', '/billing'],
  },
  {
    role: 'Accounts',
    email: 'accounts@stayos.local',
    redirectPath: '/billing',
    routes: ['/rooms', '/housekeeping', '/maintenance'],
  },
];

test.describe('direct URL access guards', () => {
  for (const scenario of deniedRoutes) {
    for (const route of scenario.routes) {
      test(`${scenario.role} cannot open ${route}`, async ({ page }) => {
        await loginAs(page, scenario.email);
        await page.goto(route);
        await expect(page).not.toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`));
      });
    }
  }
});
