import { expect, type Page } from '@playwright/test';

type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload && typeof payload === 'object') {
    if ('data' in payload && payload.data !== undefined) return payload.data;
    if ('items' in payload && payload.items !== undefined) return payload.items;
    if ('results' in payload && payload.results !== undefined) return payload.results;
  }
  return payload as T;
}

type LooseRecord = Record<string, unknown>;

export async function findCheckInReservationId(page: Page) {
  const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

  const reservationId = await page.evaluate(async (baseUrl) => {
    const token =
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken');

    if (!token) throw new Error('No auth token available for E2E discovery.');

    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    const unwrapResponse = <T,>(payload: ApiEnvelope<T>): T => {
      if (payload && typeof payload === 'object') {
        if ('data' in payload && payload.data !== undefined) return payload.data;
        if ('items' in payload && payload.items !== undefined) return payload.items;
        if ('results' in payload && payload.results !== undefined) return payload.results;
      }
      return payload as T;
    };

    const propertiesResponse = await fetch(`${baseUrl}/properties`, { headers });
    if (!propertiesResponse.ok) throw new Error('Unable to load properties for E2E discovery.');
    const properties = unwrapResponse<LooseRecord[]>(await propertiesResponse.json());
    const activeProperty =
      properties.find((property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
      properties[0];
    const propertyId = typeof activeProperty?.id === 'string' ? activeProperty.id : '';
    if (!propertyId) throw new Error('No active property found for E2E discovery.');

    const reservationsResponse = await fetch(`${baseUrl}/properties/${propertyId}/reservations`, {
      headers,
    });
    if (!reservationsResponse.ok) {
      throw new Error('Unable to load reservations for E2E discovery.');
    }
    const reservations = unwrapResponse<LooseRecord[]>(await reservationsResponse.json());
    const candidates = reservations
      .filter((reservation) => String(reservation.status ?? '').toUpperCase() === 'CONFIRMED')
      .map((reservation) => String(reservation.id ?? reservation._id ?? reservation.uuid ?? ''))
      .filter(Boolean);

    for (const id of candidates) {
      const workspaceResponse = await fetch(
        `${baseUrl}/properties/${propertyId}/reservations/${id}/check-in-workspace`,
        { headers },
      );
      if (workspaceResponse.ok) return id;
    }

    throw new Error('No check-in workspace reservation found for E2E discovery.');
  }, apiBaseUrl);

  expect(reservationId).toBeTruthy();
  return reservationId;
}

export async function openDiscoveredCheckInWorkspace(page: Page) {
  const reservationId = await findCheckInReservationId(page);
  await page.goto(`/reservations/${reservationId}/check-in`);
  await expect(page.getByTestId('checkin-wizard-nav')).toBeVisible();
  return reservationId;
}
