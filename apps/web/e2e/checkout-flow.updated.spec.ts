import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type CheckoutCandidate = {
  propertyId: string;
  reservationId: string;
};

async function discoverCheckedInCandidates(page: Page): Promise<CheckoutCandidate[]> {
  return page.evaluate(async (baseUrl) => {
    type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };

    type BrowserLooseRecord = Record<string, unknown>;

    const unwrap = <T>(payload: ApiEnvelope<T>): T => {
      if (payload && typeof payload === 'object') {
        if ('data' in payload && payload.data !== undefined) {
          return payload.data;
        }

        if ('items' in payload && payload.items !== undefined) {
          return payload.items;
        }

        if ('results' in payload && payload.results !== undefined) {
          return payload.results;
        }
      }

      return payload as T;
    };

    const token =
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken');

    if (!token) {
      throw new Error('No auth token available for checkout E2E discovery.');
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const propertiesResponse = await fetch(`${baseUrl}/properties`, { headers });

    if (!propertiesResponse.ok) {
      throw new Error(
        `Unable to load properties for checkout discovery: ${propertiesResponse.status}`,
      );
    }

    const properties = unwrap<BrowserLooseRecord[]>(await propertiesResponse.json());

    const activeProperty =
      properties.find(
        (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
      ) ?? properties[0];

    const propertyId = typeof activeProperty?.id === 'string' ? activeProperty.id : '';

    if (!propertyId) {
      throw new Error('No active property found for checkout E2E discovery.');
    }

    const reservationsResponse = await fetch(
      `${baseUrl}/properties/${propertyId}/reservations?limit=100`,
      { headers },
    );

    if (!reservationsResponse.ok) {
      throw new Error(
        `Unable to load reservations for checkout discovery: ${reservationsResponse.status}`,
      );
    }

    const reservations = unwrap<BrowserLooseRecord[]>(await reservationsResponse.json());

    return reservations
      .filter((reservation) => String(reservation.status ?? '').toUpperCase() === 'CHECKED_IN')
      .map((reservation) => ({
        propertyId,
        reservationId: String(reservation.id ?? reservation._id ?? reservation.uuid ?? ''),
      }))
      .filter((candidate) => Boolean(candidate.propertyId) && Boolean(candidate.reservationId));
  }, apiBaseUrl);
}

async function openPaidCheckedInStay(page: Page): Promise<CheckoutCandidate> {
  const candidates = await discoverCheckedInCandidates(page);

  if (candidates.length === 0) {
    throw new Error('No CHECKED_IN reservation found for checkout lifecycle testing.');
  }

  const failures: string[] = [];

  for (const candidate of candidates) {
    await page.goto(`/guest-stay/${candidate.reservationId}`, {
      waitUntil: 'domcontentloaded',
    });

    try {
      await expect(
        page.getByText('Billing & payments', {
          exact: true,
        }),
      ).toBeVisible({
        timeout: 15_000,
      });
    } catch {
      failures.push(`${candidate.reservationId}: stay workspace did not load`);
      continue;
    }

    const checkoutButton = page.getByRole('button', {
      name: 'Check Out',
      exact: true,
    });

    if (await checkoutButton.isVisible().catch(() => false)) {
      return candidate;
    }

    const settleButton = page.getByRole('button', {
      name: 'Settle & Check Out',
      exact: true,
    });

    if (await settleButton.isVisible().catch(() => false)) {
      failures.push(`${candidate.reservationId}: outstanding balance`);
      continue;
    }

    failures.push(`${candidate.reservationId}: checkout action unavailable`);
  }

  throw new Error(
    [
      'Checked-in reservations were found, but none is currently ready for final checkout.',
      'The lifecycle test requires a checked-in stay with a settled/paid folio.',
      ...failures,
    ].join('\n'),
  );
}

async function readReservationStatus(page: Page, candidate: CheckoutCandidate) {
  return page.evaluate(
    async ({ baseUrl, propertyId, reservationId }) => {
      type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };

      type BrowserLooseRecord = Record<string, unknown>;

      const unwrap = <T>(payload: ApiEnvelope<T>): T => {
        if (payload && typeof payload === 'object') {
          if ('data' in payload && payload.data !== undefined) {
            return payload.data;
          }

          if ('items' in payload && payload.items !== undefined) {
            return payload.items;
          }

          if ('results' in payload && payload.results !== undefined) {
            return payload.results;
          }
        }

        return payload as T;
      };

      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');

      if (!token) {
        throw new Error('No auth token available while verifying checkout status.');
      }

      const response = await fetch(`${baseUrl}/properties/${propertyId}/reservations?limit=100`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to verify checkout status: ${response.status}`);
      }

      const reservations = unwrap<BrowserLooseRecord[]>(await response.json());

      const reservation = reservations.find(
        (item) => String(item.id ?? item._id ?? item.uuid ?? '') === reservationId,
      );

      if (!reservation) {
        throw new Error(`Reservation ${reservationId} was not found after checkout.`);
      }

      return String(reservation.status ?? '').toUpperCase();
    },
    {
      baseUrl: apiBaseUrl,
      propertyId: candidate.propertyId,
      reservationId: candidate.reservationId,
    },
  );
}

async function openDepartures(page: Page) {
  await loginAs(page, frontDeskEmail);

  await page.goto('/');

  await page
    .getByRole('link', {
      name: /Check Out/,
    })
    .click();

  await expect(page).toHaveURL(/\/reservations\?filter=departures-today$/);

  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Bookings',
    }),
  ).toBeVisible();
}

test.describe('checkout flow V1 smoke', () => {
  test.setTimeout(90_000);

  test('front desk checkout card opens departures with operational guidance', async ({ page }) => {
    await openDepartures(page);

    await expect(page.getByText('Guests expected to leave today.')).toBeVisible();

    await expect(page.getByText('Showing checked-in guests departing today.')).toBeVisible();

    await expect(
      page.getByRole('link', {
        name: 'Back to Front Desk',
      }),
    ).toBeVisible();

    const visibleRows = page.locator('[data-testid^="booking-row-"]');

    const rowCount = await visibleRows.count();

    if (rowCount === 0) {
      await expect(page.getByText('No bookings found')).toBeVisible();

      return;
    }

    await expect(page.locator('[data-testid^="booking-next-action-"]').first()).toContainText(
      'Check Out',
    );
  });

  test('departure next action opens the booking detail checkout context', async ({ page }) => {
    await openDepartures(page);

    const actions = page.locator('[data-testid^="booking-next-action-"]');

    const actionCount = await actions.count();

    test.skip(actionCount === 0, 'No departures due in the current demo data.');

    await actions.first().click();

    await expect(page).toHaveURL(/\/reservations\/[^/]+$/);

    await expect(page.getByText('Back to Front Desk')).toBeVisible();

    await expect(page.getByTestId('booking-next-action-cta')).toContainText(/Check Out|Open Stay/);
  });

  test('stay workspace checkout explains whether to collect payment or confirm checkout', async ({
    page,
  }) => {
    await loginAs(page, frontDeskEmail);

    const candidates = await discoverCheckedInCandidates(page);

    test.skip(candidates.length === 0, 'No checked-in stays in the current demo data.');

    await page.goto(`/guest-stay/${candidates[0].reservationId}`);

    await expect(
      page.getByText('Billing & payments', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page
      .getByRole('button', {
        name: /Check Out|Settle & Check Out/,
      })
      .click();

    const modal = page.getByTestId('stay-checkout-modal');

    await expect(modal).toBeVisible();

    const goToBilling = modal.getByRole('button', {
      name: 'Go to Billing',
    });

    const confirmCheckout = modal.getByRole('button', {
      name: 'Check Out',
      exact: true,
    });

    if (await goToBilling.isVisible()) {
      await expect(modal).toContainText('Collect payment from Billing & payments');

      await goToBilling.click();

      await expect(page.getByTestId('payment-amount')).toBeVisible();

      await page.keyboard.press('Escape');

      return;
    }

    await expect(confirmCheckout).toBeVisible();

    await expect(modal).toContainText('The room will be marked for cleaning');

    await modal
      .getByRole('button', {
        name: 'Cancel',
      })
      .click();

    await expect(modal).toHaveCount(0);
  });

  test('checkout modal never exposes final checkout while balance is outstanding', async ({
    page,
  }) => {
    await loginAs(page, frontDeskEmail);

    const candidates = await discoverCheckedInCandidates(page);

    test.skip(candidates.length === 0, 'No checked-in stays in the current demo data.');

    await page.goto(`/guest-stay/${candidates[0].reservationId}`);

    await expect(
      page.getByText('Billing & payments', {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page
      .getByRole('button', {
        name: /Check Out|Settle & Check Out/,
      })
      .click();

    const modal = page.getByTestId('stay-checkout-modal');

    await expect(modal).toBeVisible();

    if (
      await modal
        .getByRole('button', {
          name: 'Go to Billing',
        })
        .isVisible()
    ) {
      await expect(
        modal.getByRole('button', {
          name: 'Check Out',
          exact: true,
        }),
      ).toHaveCount(0);
    } else {
      await expect(
        modal.getByRole('button', {
          name: 'Check Out',
          exact: true,
        }),
      ).toBeVisible();
    }
  });
});

test.describe('checkout lifecycle - pre Channel Manager readiness', () => {
  test.setTimeout(90_000);

  test('complete final checkout and close the stay', async ({ page }) => {
    await test.step('login and discover a paid checked-in stay', async () => {
      await loginAs(page, frontDeskEmail);
    });

    const candidate = await openPaidCheckedInStay(page);

    const roomText = (
      await page
        .getByText(/^Room .+ - .+$/)
        .first()
        .textContent()
    )?.trim();

    await test.step('verify final checkout is allowed', async () => {
      await expect(
        page.getByRole('button', {
          name: 'Check Out',
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole('button', {
          name: 'Settle & Check Out',
          exact: true,
        }),
      ).toHaveCount(0);
    });

    await test.step('confirm checkout', async () => {
      await page
        .getByRole('button', {
          name: 'Check Out',
          exact: true,
        })
        .click();

      const modal = page.getByTestId('stay-checkout-modal');

      await expect(modal).toBeVisible();

      await expect(modal).toContainText(
        'Confirm checkout. The room will be marked for cleaning and the stay will close.',
      );

      await expect(
        modal.getByRole('button', {
          name: 'Go to Billing',
        }),
      ).toHaveCount(0);

      await modal
        .getByRole('button', {
          name: 'Check Out',
          exact: true,
        })
        .click();
    });

    await test.step('checkout redirects back to Rooms', async () => {
      await expect(page).toHaveURL(/\/rooms\?checkout=success&/, {
        timeout: 20_000,
      });

      const url = new URL(page.url());

      expect(url.searchParams.get('checkout')).toBe('success');

      expect(url.searchParams.get('guest')).toBeTruthy();

      expect(url.searchParams.get('room')).toBeTruthy();

      if (roomText) {
        const roomNumberMatch = roomText.match(/^Room ([^-]+?)\s*-/);

        if (roomNumberMatch?.[1]) {
          expect(url.searchParams.get('room')).toContain(roomNumberMatch[1].trim());
        }
      }
    });

    await test.step('reservation is now checked out', async () => {
      await expect
        .poll(async () => readReservationStatus(page, candidate), {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
        })
        .toBe('CHECKED_OUT');
    });

    await test.step('closed stay is no longer available as an active guest stay', async () => {
      await page.goto(`/guest-stay/${candidate.reservationId}`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(
        page.getByRole('button', {
          name: 'Check Out',
          exact: true,
        }),
      ).toHaveCount(0);

      await expect(
        page.getByRole('button', {
          name: 'Settle & Check Out',
          exact: true,
        }),
      ).toHaveCount(0);
    });
  });
});
