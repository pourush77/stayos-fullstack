import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty, resetE2EPropertyState } from './helpers/e2e-property';

const frontDeskEmail =
  process.env.E2E_FRONT_DESK_EMAIL ?? process.env.E2E_EMAIL ?? 'frontdesk@stayos.local';

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ??
  process.env.E2E_API_BASE_URL ??
  'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type LooseRecord = Record<string, unknown>;

type ApiRequestInput = {
  method?: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
};

type ApiResult<T> = {
  ok: boolean;
  status: number;
  body: T;
};

type Scenario = {
  propertyId: string;
  arrivalDate: string;
  departureDate: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
};

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

      if (!token) {
        throw new Error('No auth token available for reservation date-guard E2E API call.');
      }

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
    {
      baseUrl: apiBaseUrl,
      request: input,
    },
  );
}

async function getActivePropertyId(page: Page) {
  return (await ensureE2EProperty(page)).id;
}

async function discoverFutureReadyRoom(page: Page): Promise<Scenario> {
  const propertyId = await getActivePropertyId(page);
  const today = toDateKey(new Date());
  const arrivalDate = addDays(today, 3);
  const departureDate = addDays(arrivalDate, 1);

  const response = await apiRequest<LooseRecord[]>(page, {
    path:
      `/properties/${propertyId}/operations/available-rooms` +
      `?arrivalDate=${arrivalDate}` +
      `&departureDate=${departureDate}` +
      `&guestCount=1&adults=1&children=0`,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to discover READY room for future dates: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  for (const room of response.body) {
    const status = normalizeStatus(String(room.uiStatus ?? room.operationalStatus ?? 'READY'));

    if (status && status !== 'READY') continue;

    const roomType = (room.roomType ?? {}) as LooseRecord;
    const roomId = String(room.roomId ?? room.id ?? '');
    const roomNumber = String(room.roomNumber ?? '');
    const roomTypeId = String(roomType.id ?? '');

    if (roomId && roomNumber && roomTypeId) {
      return {
        propertyId,
        arrivalDate,
        departureDate,
        roomId,
        roomNumber,
        roomTypeId,
      };
    }
  }

  throw new Error(
    'Could not find a READY room for the future reservation window. Reset/seed local E2E inventory and rerun.',
  );
}

async function createGuest(page: Page, propertyId: string) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${propertyId}/guests`,
    body: {
      firstName: 'E2E',
      lastName: `Future${unique.slice(-6)}`,
      phone: `9${unique.slice(-9)}`.slice(0, 10),
      email: `e2e.future.${unique}@example.com`,
      nationality: 'Indian',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to create guest: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  const guestId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');

  if (!guestId) {
    throw new Error('Guest created but no guest id was returned.');
  }

  return guestId;
}

async function createConfirmedReservation(page: Page, scenario: Scenario, guestId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${scenario.propertyId}/reservations`,
    body: {
      guestId,
      arrivalDate: scenario.arrivalDate,
      departureDate: scenario.departureDate,
      adults: 1,
      children: 0,
      roomTypeId: scenario.roomTypeId,
      source: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      notes: 'E2E future-arrival check-in guard',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to create reservation: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  const reservationId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');

  if (!reservationId) {
    throw new Error('Reservation created but no reservation id was returned.');
  }

  return reservationId;
}

async function assignRoom(page: Page, propertyId: string, reservationId: string, roomId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/assign-room`,
    body: { roomId },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to assign room: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }
}

async function readReservation(page: Page, propertyId: string, reservationId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    path: `/properties/${propertyId}/reservations/${reservationId}`,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to read reservation: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  return response.body;
}

async function readRoomBoardItem(page: Page, propertyId: string, roomId: string) {
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/operations/room-board`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read room board: HTTP ${response.status}`);
  }

  const room = response.body.find((item) => String(item.roomId ?? item.id ?? '') === roomId);

  if (!room) {
    throw new Error(`Room ${roomId} not found in room board.`);
  }

  return room;
}

async function cancelReservationBestEffort(page: Page, propertyId: string, reservationId: string) {
  const current = await readReservation(page, propertyId, reservationId).catch(() => undefined);

  if (!current) return;

  const status = normalizeStatus(String(current.status ?? ''));

  if (status !== 'PENDING' && status !== 'CONFIRMED') return;

  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}`,
    body: {
      status: 'CANCELLED',
    },
  }).catch(() => undefined);
}

test.describe('reservation check-in date guard', () => {
  test.beforeEach(() => {
    resetE2EPropertyState();
  });

  test('future confirmed reservation cannot be checked in before arrival date', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await loginAs(page, frontDeskEmail);

    const scenario = await discoverFutureReadyRoom(page);
    const guestId = await createGuest(page, scenario.propertyId);
    const reservationId = await createConfirmedReservation(page, scenario, guestId);

    try {
      await assignRoom(page, scenario.propertyId, reservationId, scenario.roomId);

      await test.step('booking detail blocks Start Check-In for future arrival', async () => {
        await page.goto(`/reservations/${reservationId}`);
        await page.waitForLoadState('domcontentloaded');

        await expect(
          page.getByRole('alert').filter({
            hasText: /Check-in not available yet/i,
          }),
        ).toBeVisible({
          timeout: 20_000,
        });

        const formattedArrival = new Date(`${scenario.arrivalDate}T00:00:00`).toLocaleDateString(
          'en-IN',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          },
        );

        await expect(page.getByText(formattedArrival, { exact: true }).first()).toBeVisible();

        const nextAction = page.getByTestId('booking-next-action-cta');

        await expect(nextAction).toBeVisible();
        await expect(nextAction).toBeDisabled();

        await expect(page.getByRole('link', { name: /Start Check[- ]?In/i })).toHaveCount(0);
      });

      await test.step('direct backend check-in is rejected before arrival date', async () => {
        const response = await apiRequest<LooseRecord>(page, {
          method: 'PATCH',
          path: `/properties/${scenario.propertyId}/reservations/${reservationId}/check-in`,
          body: {},
        });

        expect(response.ok).toBeFalsy();
        expect(response.status).toBe(400);

        expect(JSON.stringify(response.body)).toMatch(
          /CHECKIN_BEFORE_ARRIVAL_DATE|before the reservation arrival date|check-in is not available before/i,
        );
      });

      await test.step('reservation and room state remain unchanged', async () => {
        const reservation = await readReservation(page, scenario.propertyId, reservationId);

        expect(normalizeStatus(String(reservation.status ?? ''))).toBe('CONFIRMED');

        const room = await readRoomBoardItem(page, scenario.propertyId, scenario.roomId);

        expect(normalizeStatus(String(room.uiStatus ?? room.operationalStatus ?? ''))).not.toBe(
          'OCCUPIED',
        );
      });
    } finally {
      await cancelReservationBestEffort(page, scenario.propertyId, reservationId).catch(
        () => undefined,
      );
    }
  });
});
