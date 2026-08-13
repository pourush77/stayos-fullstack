import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const frontDeskEmail =
  process.env.E2E_FRONT_DESK_EMAIL ?? process.env.E2E_EMAIL ?? 'frontdesk@stayos.local';
const maintenanceEmail = process.env.E2E_MAINTENANCE_EMAIL ?? 'maintenance@stayos.local';
const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ??
  process.env.E2E_API_BASE_URL ??
  'http://localhost:3002/api/v1';

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' });

type LooseRecord = Record<string, unknown>;
type ApiRequestInput = {
  method?: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
};
type ApiResult<T> = { ok: boolean; status: number; body: T };
type ReadyRoom = { roomId: string; roomNumber: string; roomTypeId: string };
type Scenario = { propertyId: string; arrivalDate: string; departureDate: string; room: ReadyRoom };

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return toDateKey(next);
}

function normalizeStatus(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, '_');
}

async function apiRequest<T>(page: Page, input: ApiRequestInput): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ baseUrl, request }) => {
      type ApiEnvelope<TValue> =
        TValue | { data?: TValue } | { items?: TValue } | { results?: TValue };
      const unwrap = <TValue>(payload: ApiEnvelope<TValue>): TValue => {
        if (payload && typeof payload === 'object') {
          if ('data' in payload && payload.data !== undefined) return payload.data;
          if ('items' in payload && payload.items !== undefined) return payload.items;
          if ('results' in payload && payload.results !== undefined) return payload.results;
        }
        return payload as TValue;
      };

      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');
      if (!token)
        throw new Error('No auth token available for reservation cancellation E2E API call.');

      const response = await fetch(`${baseUrl}${request.path}`, {
        method: request.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(request.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      const rawBody = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        body: response.ok ? unwrap<T>(rawBody as ApiEnvelope<T>) : (rawBody as T),
      };
    },
    { baseUrl: apiBaseUrl, request: input },
  );
}

async function getActivePropertyId(page: Page) {
  const response = await apiRequest<LooseRecord[]>(page, { path: '/properties' });
  if (!response.ok) throw new Error(`Unable to load properties: HTTP ${response.status}`);
  const property =
    response.body.find((item) => String(item.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
    response.body[0];
  const propertyId = String(property?.id ?? property?._id ?? property?.uuid ?? '');
  if (!propertyId) throw new Error('No active property found for reservation cancellation E2E.');
  return propertyId;
}

async function discoverReadyRoomForToday(page: Page): Promise<Scenario> {
  const propertyId = await getActivePropertyId(page);
  const arrivalDate = toDateKey(new Date());
  const departureDate = addDays(arrivalDate, 1);
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/operations/available-rooms?arrivalDate=${arrivalDate}&departureDate=${departureDate}&guestCount=1&adults=1&children=0`,
  });
  if (!response.ok)
    throw new Error(
      `Unable to discover READY rooms: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );

  for (const room of response.body) {
    const status = normalizeStatus(String(room.uiStatus ?? room.operationalStatus ?? 'READY'));
    if (status && status !== 'READY') continue;
    const roomType = (room.roomType ?? {}) as LooseRecord;
    const roomId = String(room.roomId ?? room.id ?? '');
    const roomNumber = String(room.roomNumber ?? '');
    const roomTypeId = String(roomType.id ?? '');
    if (roomId && roomNumber && roomTypeId) {
      return { propertyId, arrivalDate, departureDate, room: { roomId, roomNumber, roomTypeId } };
    }
  }

  throw new Error(
    'Could not find a vacant READY room for today. Reset/seed local E2E inventory and rerun.',
  );
}

async function createUniqueGuest(page: Page, propertyId: string) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${propertyId}/guests`,
    body: {
      firstName: 'E2E',
      lastName: `Cancel${unique.slice(-6)}`,
      phone: `9${unique.slice(-9)}`.slice(0, 10),
      email: `e2e.cancel.${unique}@example.com`,
      nationality: 'Indian',
    },
  });
  if (!response.ok)
    throw new Error(
      `Unable to create guest: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  const guestId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');
  if (!guestId) throw new Error('Guest created but no guest id was returned.');
  return guestId;
}

async function createConfirmedReservation(page: Page, input: Scenario & { guestId: string }) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${input.propertyId}/reservations`,
    body: {
      guestId: input.guestId,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      adults: 1,
      children: 0,
      roomTypeId: input.room.roomTypeId,
      source: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAYMENT_DUE',
      notes: 'E2E reservation cancellation regression',
    },
  });
  if (!response.ok)
    throw new Error(
      `Unable to create reservation: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  const reservationId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');
  if (!reservationId) throw new Error('Reservation created but no reservation id was returned.');
  return reservationId;
}

async function assignReservationRoom(
  page: Page,
  propertyId: string,
  reservationId: string,
  roomId: string,
) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/assign-room`,
    body: { roomId },
  });
  if (!response.ok)
    throw new Error(
      `Unable to assign room: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
}

async function readReservation(page: Page, propertyId: string, reservationId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    path: `/properties/${propertyId}/reservations/${reservationId}`,
  });
  if (!response.ok)
    throw new Error(
      `Unable to read reservation: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  return response.body;
}

async function getRoomOperationalStatus(page: Page, propertyId: string, roomId: string) {
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/operations/room-board`,
  });
  if (!response.ok) throw new Error(`Unable to read room board: HTTP ${response.status}`);
  const room = response.body.find((item) => String(item.roomId ?? item.id ?? '') === roomId);
  if (!room) throw new Error(`Room ${roomId} not found in room board.`);
  return normalizeStatus(String(room.uiStatus ?? room.operationalStatus ?? ''));
}

async function reportBlockingMaintenance(
  page: Page,
  input: { propertyId: string; roomId: string; roomNumber: string },
) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${input.propertyId}/maintenance`,
    body: {
      roomId: input.roomId,
      title: `E2E cancellation maintenance ${input.roomNumber} ${Date.now()}`,
      description: 'Temporary blocking maintenance used to verify reservation cancellation',
      category: 'OTHER',
      priority: 'HIGH',
      makeRoomUnavailable: true,
    },
  });
  if (!response.ok)
    throw new Error(
      `Unable to create maintenance ticket: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  const ticketId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');
  if (!ticketId) throw new Error('Maintenance ticket created but no ticket id returned.');
  return ticketId;
}

async function resolveMaintenanceTicketBestEffort(
  page: Page,
  propertyId: string,
  ticketId: string,
) {
  if (!ticketId) return;
  await loginAs(page, maintenanceEmail).catch(() => undefined);
  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/maintenance/${ticketId}/resolve`,
    body: { resolutionNote: 'Automatic cleanup after reservation cancellation E2E test' },
  }).catch(() => undefined);
  await loginAs(page, frontDeskEmail).catch(() => undefined);
}

async function cancelReservationBestEffort(page: Page, propertyId: string, reservationId: string) {
  const current = await readReservation(page, propertyId, reservationId).catch(() => undefined);
  if (!current) return;
  const status = normalizeStatus(String(current.status ?? ''));
  if (status !== 'PENDING' && status !== 'CONFIRMED') return;
  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}`,
    body: { status: 'CANCELLED' },
  }).catch(() => undefined);
}

test.describe('reservation cancellation regression', () => {
  test('confirmed reservation can be cancelled even when assigned room is under maintenance', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAs(page, frontDeskEmail);

    const scenario = await discoverReadyRoomForToday(page);
    const guestId = await createUniqueGuest(page, scenario.propertyId);
    const reservationId = await createConfirmedReservation(page, { ...scenario, guestId });
    let maintenanceTicketId = '';

    try {
      await assignReservationRoom(page, scenario.propertyId, reservationId, scenario.room.roomId);

      const before = await readReservation(page, scenario.propertyId, reservationId);
      expect(normalizeStatus(String(before.status ?? ''))).toBe('CONFIRMED');
      expect(String(before.roomId ?? '')).toBe(scenario.room.roomId);

      maintenanceTicketId = await reportBlockingMaintenance(page, {
        propertyId: scenario.propertyId,
        roomId: scenario.room.roomId,
        roomNumber: scenario.room.roomNumber,
      });

      await expect
        .poll(() => getRoomOperationalStatus(page, scenario.propertyId, scenario.room.roomId), {
          timeout: 20_000,
          intervals: [300, 700, 1_500],
        })
        .toBe('MAINTENANCE');

      await page.goto(`/reservations/${reservationId}`);
      await page.waitForLoadState('domcontentloaded');

      const cancelButton = page.getByRole('button', { name: 'Cancel Booking', exact: true });
      await expect(cancelButton).toBeVisible({ timeout: 20_000 });
      await cancelButton.click();

      const cancelDialog = page
        .locator('[role="dialog"]')
        .filter({ hasText: /cancel/i })
        .last();
      await expect(cancelDialog).toBeVisible();

      const confirmCancelButton = cancelDialog.getByRole('button', {
        name: /Cancel Booking|Confirm Cancellation|Cancel Reservation/i,
      });
      await expect(confirmCancelButton).toBeVisible();

      const cancelResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response
            .url()
            .includes(`/properties/${scenario.propertyId}/reservations/${reservationId}`),
      );

      await confirmCancelButton.click();
      const cancelResponse = await cancelResponsePromise;
      expect(
        cancelResponse.ok(),
        `Cancellation PATCH returned HTTP ${cancelResponse.status()}`,
      ).toBeTruthy();

      await expect
        .poll(
          async () => {
            const current = await readReservation(page, scenario.propertyId, reservationId);
            return normalizeStatus(String(current.status ?? ''));
          },
          { timeout: 20_000, intervals: [300, 700, 1_500] },
        )
        .toBe('CANCELLED');

      await expect(page.getByText(/This booking is cancelled/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Cancel Booking', exact: true })).toHaveCount(
        0,
      );
    } finally {
      await cancelReservationBestEffort(page, scenario.propertyId, reservationId).catch(
        () => undefined,
      );
      await resolveMaintenanceTicketBestEffort(
        page,
        scenario.propertyId,
        maintenanceTicketId,
      ).catch(() => undefined);
    }
  });
});
