import { expect, type Page } from '@playwright/test';

type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };
type LooseRecord = Record<string, unknown>;

export async function findCheckedInReservationId(page: Page) {
  const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

  const reservationId = await page.evaluate(async (baseUrl) => {
    const token =
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken');

    if (!token) throw new Error('No auth token available for E2E stay discovery.');

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
    if (!propertiesResponse.ok) throw new Error('Unable to load properties for E2E stay discovery.');
    const properties = unwrapResponse<LooseRecord[]>(await propertiesResponse.json());
    const activeProperty =
      properties.find((property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
      properties[0];
    const propertyId = typeof activeProperty?.id === 'string' ? activeProperty.id : '';
    if (!propertyId) throw new Error('No active property found for E2E stay discovery.');

    const reservationsResponse = await fetch(`${baseUrl}/properties/${propertyId}/reservations`, {
      headers,
    });
    if (!reservationsResponse.ok) {
      throw new Error('Unable to load reservations for E2E stay discovery.');
    }
    const reservations = unwrapResponse<LooseRecord[]>(await reservationsResponse.json());
    const checkedIn = reservations.find(
      (reservation) => String(reservation.status ?? '').toUpperCase() === 'CHECKED_IN',
    );

    const id =
      typeof checkedIn?.id === 'string'
        ? checkedIn.id
        : typeof checkedIn?._id === 'string'
          ? checkedIn._id
          : typeof checkedIn?.uuid === 'string'
            ? checkedIn.uuid
            : '';
    if (!id) throw new Error('No checked-in reservation found for E2E stay discovery.');
    return id;
  }, apiBaseUrl);

  expect(reservationId).toBeTruthy();
  return reservationId;
}

export async function openDiscoveredStayWorkspace(page: Page) {
  const reservationId = await findCheckedInReservationId(page);
  await page.goto(`/guest-stay/${reservationId}`);
  await expect(page.getByText('Billing & payments')).toBeVisible();
  return reservationId;
}
