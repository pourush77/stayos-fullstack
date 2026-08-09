import { expect, type Page } from '@playwright/test';

type CheckInCandidate = {
  reservationId: string;
  propertyId: string;
};

export async function findCheckInReservationCandidates(page: Page): Promise<CheckInCandidate[]> {
  const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

  const candidates = await page.evaluate(async (baseUrl) => {
    type BrowserApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };

    type BrowserLooseRecord = Record<string, unknown>;

    const unwrapResponse = <T>(payload: BrowserApiEnvelope<T>): T => {
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
      throw new Error('No auth token available for E2E discovery.');
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const propertiesResponse = await fetch(`${baseUrl}/properties`, { headers });

    if (!propertiesResponse.ok) {
      throw new Error(`Unable to load properties for E2E discovery: ${propertiesResponse.status}`);
    }

    const properties = unwrapResponse<BrowserLooseRecord[]>(await propertiesResponse.json());

    const activeProperty =
      properties.find(
        (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
      ) ?? properties[0];

    const propertyId = typeof activeProperty?.id === 'string' ? activeProperty.id : '';

    if (!propertyId) {
      throw new Error('No active property found for E2E discovery.');
    }

    const reservationsResponse = await fetch(
      `${baseUrl}/properties/${propertyId}/reservations?limit=100`,
      { headers },
    );

    if (!reservationsResponse.ok) {
      throw new Error(
        `Unable to load reservations for E2E discovery: ${reservationsResponse.status}`,
      );
    }

    const reservations = unwrapResponse<BrowserLooseRecord[]>(await reservationsResponse.json());

    const reservationIds = reservations
      .filter((reservation) => String(reservation.status ?? '').toUpperCase() === 'CONFIRMED')
      .map((reservation) => String(reservation.id ?? reservation._id ?? reservation.uuid ?? ''))
      .filter(Boolean);

    const suitable: Array<{
      reservationId: string;
      propertyId: string;
    }> = [];

    for (const reservationId of reservationIds) {
      const workspaceResponse = await fetch(
        `${baseUrl}/properties/${propertyId}/reservations/${reservationId}/check-in-workspace`,
        { headers },
      );

      if (!workspaceResponse.ok) {
        continue;
      }

      const workspace = unwrapResponse<BrowserLooseRecord>(await workspaceResponse.json());

      const booking = (workspace.booking ?? {}) as BrowserLooseRecord;
      const room = (workspace.room ?? {}) as BrowserLooseRecord;

      const bookingStatus = String(booking.status ?? '').toUpperCase();

      const roomId = String(room.roomId ?? '');
      const roomReady = room.readyForCheckIn === true;

      // We only want a reservation that can genuinely proceed
      // through the receptionist check-in workflow:
      // - still CONFIRMED
      // - has a physical room assigned
      // - assigned room is ready for check-in
      if (bookingStatus !== 'CONFIRMED' || !roomId || !roomReady) {
        continue;
      }

      suitable.push({
        reservationId,
        propertyId,
      });
    }

    return suitable;
  }, apiBaseUrl);

  return candidates;
}

export async function findCheckInReservationId(page: Page): Promise<string> {
  const candidates = await findCheckInReservationCandidates(page);

  const first = candidates[0];

  if (!first?.reservationId) {
    throw new Error(
      'No CONFIRMED reservation with an assigned Ready room was found for E2E check-in discovery.',
    );
  }

  return first.reservationId;
}

export async function openDiscoveredCheckInWorkspace(page: Page): Promise<string> {
  const candidates = await findCheckInReservationCandidates(page);

  if (candidates.length === 0) {
    throw new Error(
      'No CONFIRMED reservation with an assigned Ready room was found for E2E check-in discovery.',
    );
  }

  const failures: string[] = [];

  for (const candidate of candidates) {
    const { reservationId } = candidate;

    await page.goto(`/reservations/${reservationId}/check-in`, {
      waitUntil: 'domcontentloaded',
    });

    const wizard = page.getByTestId('checkin-wizard-nav');

    try {
      await expect(wizard).toBeVisible({
        timeout: 15_000,
      });

      return reservationId;
    } catch {
      const pageText = await page
        .locator('body')
        .innerText()
        .catch(() => '');

      failures.push(
        `${reservationId}: ${
          pageText.replace(/\s+/g, ' ').trim().slice(0, 220) || 'wizard did not render'
        }`,
      );
    }
  }

  throw new Error(
    [
      'Found candidate reservations, but none opened a usable check-in workspace.',
      ...failures,
    ].join('\n'),
  );
}
