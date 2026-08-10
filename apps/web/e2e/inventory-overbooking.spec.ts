import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type InventoryCandidate = {
  propertyId: string;
  guestId: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  arrivalDate: string;
  departureDate: string;
};

type CreatedReservation = {
  id: string;
  reservationCode?: string;
};

async function discoverInventoryCandidate(
  page: Page,
): Promise<InventoryCandidate> {
  return page.evaluate(async (baseUrl) => {
    type ApiEnvelope<T> =
      | T
      | { data?: T }
      | { items?: T }
      | { results?: T };

    type LooseRecord = Record<string, unknown>;

    const unwrap = <T,>(payload: ApiEnvelope<T>): T => {
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
      throw new Error(
        'No auth token available for inventory E2E discovery.',
      );
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const propertiesResponse = await fetch(
      `${baseUrl}/properties`,
      { headers },
    );

    if (!propertiesResponse.ok) {
      throw new Error(
        `Unable to load properties: ${propertiesResponse.status}`,
      );
    }

    const properties = unwrap<LooseRecord[]>(
      await propertiesResponse.json(),
    );

    const activeProperty =
      properties.find(
        (property) =>
          String(property.status ?? 'ACTIVE').toUpperCase() ===
          'ACTIVE',
      ) ?? properties[0];

    const propertyId = String(activeProperty?.id ?? '');

    if (!propertyId) {
      throw new Error(
        'No active property found for inventory E2E test.',
      );
    }

    const reservationsResponse = await fetch(
      `${baseUrl}/properties/${propertyId}/reservations?limit=100`,
      { headers },
    );

    if (!reservationsResponse.ok) {
      throw new Error(
        `Unable to load reservations: ${reservationsResponse.status}`,
      );
    }

    const reservations = unwrap<LooseRecord[]>(
      await reservationsResponse.json(),
    );

    const reusableGuestId = reservations
      .map((reservation) => String(reservation.guestId ?? ''))
      .find(Boolean);

    if (!reusableGuestId) {
      throw new Error(
        'No existing guest could be discovered for inventory E2E test.',
      );
    }

    const toDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

    // Search sufficiently far into the future so seeded/demo stays
    // do not make this test flaky.
    for (let offset = 21; offset <= 90; offset += 3) {
      const arrival = new Date();
      arrival.setHours(12, 0, 0, 0);
      arrival.setDate(arrival.getDate() + offset);

      const departure = new Date(arrival);
      departure.setDate(departure.getDate() + 2);

      const arrivalDate = toDate(arrival);
      const departureDate = toDate(departure);

      const url = new URL(
        `${baseUrl}/properties/${propertyId}/operations/available-rooms`,
      );

      url.searchParams.set('arrivalDate', arrivalDate);
      url.searchParams.set('departureDate', departureDate);
      url.searchParams.set('guestCount', '1');
      url.searchParams.set('adults', '1');
      url.searchParams.set('children', '0');

      const availableResponse = await fetch(
        url.toString(),
        { headers },
      );

      if (!availableResponse.ok) {
        continue;
      }

      const rooms = unwrap<LooseRecord[]>(
        await availableResponse.json(),
      );

      const candidate = rooms.find((room) => {
        const roomId = String(room.roomId ?? room.id ?? '');
        const roomType =
          (room.roomType ?? {}) as LooseRecord;
        const roomTypeId = String(roomType.id ?? '');

        return Boolean(roomId && roomTypeId);
      });

      if (!candidate) {
        continue;
      }

      const roomType =
        (candidate.roomType ?? {}) as LooseRecord;

      return {
        propertyId,
        guestId: reusableGuestId,
        roomId: String(
          candidate.roomId ?? candidate.id ?? '',
        ),
        roomNumber: String(
          candidate.roomNumber ?? '',
        ),
        roomTypeId: String(roomType.id ?? ''),
        roomTypeName: String(
          roomType.name ??
            roomType.code ??
            'Room type',
        ),
        arrivalDate,
        departureDate,
      };
    }

    throw new Error(
      'No Ready room could be found for a future two-night inventory test window.',
    );
  }, apiBaseUrl);
}

async function apiRequest<T>(
  page: Page,
  input: {
    method?: 'GET' | 'POST' | 'PATCH';
    path: string;
    body?: Record<string, unknown>;
  },
): Promise<{
  ok: boolean;
  status: number;
  body: T;
}> {
  return page.evaluate(
    async ({ baseUrl, request }) => {
      type ApiEnvelope<TValue> =
        | TValue
        | { data?: TValue }
        | { items?: TValue }
        | { results?: TValue };

      const unwrap = <TValue,>(
        payload: ApiEnvelope<TValue>,
      ): TValue => {
        if (payload && typeof payload === 'object') {
          if (
            'data' in payload &&
            payload.data !== undefined
          ) {
            return payload.data;
          }

          if (
            'items' in payload &&
            payload.items !== undefined
          ) {
            return payload.items;
          }

          if (
            'results' in payload &&
            payload.results !== undefined
          ) {
            return payload.results;
          }
        }

        return payload as TValue;
      };

      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');

      if (!token) {
        throw new Error(
          'No auth token available for inventory E2E API call.',
        );
      }

      const response = await fetch(
        `${baseUrl}${request.path}`,
        {
          method: request.method ?? 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(request.body
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          ...(request.body
            ? { body: JSON.stringify(request.body) }
            : {}),
        },
      );

      const rawBody = await response
        .json()
        .catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        body: response.ok
          ? unwrap<T>(rawBody)
          : (rawBody as T),
      };
    },
    {
      baseUrl: apiBaseUrl,
      request: input,
    },
  );
}

async function createReservation(
  page: Page,
  candidate: InventoryCandidate,
  label: string,
): Promise<CreatedReservation> {
  const response = await apiRequest<
    Record<string, unknown>
  >(page, {
    method: 'POST',
    path: `/properties/${candidate.propertyId}/reservations`,
    body: {
      guestId: candidate.guestId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
      adults: 1,
      children: 0,
      roomTypeId: candidate.roomTypeId,
      source: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAYMENT_DUE',
      notes: `E2E inventory protection - ${label}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to create ${label}: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  const id = String(
    response.body.id ??
      response.body._id ??
      response.body.uuid ??
      '',
  );

  if (!id) {
    throw new Error(
      `${label} was created but no reservation id was returned.`,
    );
  }

  return {
    id,
    reservationCode: String(
      response.body.reservationCode ?? '',
    ),
  };
}

async function assignRoom(
  page: Page,
  candidate: InventoryCandidate,
  reservationId: string,
) {
  return apiRequest<Record<string, unknown>>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${reservationId}/assign-room`,
    body: {
      roomId: candidate.roomId,
    },
  });
}

async function cancelReservation(
  page: Page,
  candidate: InventoryCandidate,
  reservationId: string,
) {
  return apiRequest<Record<string, unknown>>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${reservationId}`,
    body: {
      status: 'CANCELLED',
    },
  });
}

async function getAvailableRoomIds(
  page: Page,
  candidate: InventoryCandidate,
): Promise<string[]> {
  const query = new URLSearchParams({
    arrivalDate: candidate.arrivalDate,
    departureDate: candidate.departureDate,
    roomTypeId: candidate.roomTypeId,
    guestCount: '1',
    adults: '1',
    children: '0',
  });

  const response = await apiRequest<
    Array<Record<string, unknown>>
  >(page, {
    path: `/properties/${candidate.propertyId}/operations/available-rooms?${query.toString()}`,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to read available rooms: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  return response.body
    .map((room) =>
      String(room.roomId ?? room.id ?? ''),
    )
    .filter(Boolean);
}

function extractApiError(
  body: Record<string, unknown>,
) {
  const nestedError =
    body.error &&
    typeof body.error === 'object'
      ? (body.error as Record<string, unknown>)
      : undefined;

  return {
    code: String(
      nestedError?.code ??
        body.code ??
        '',
    ),
    message: String(
      nestedError?.message ??
        body.message ??
        '',
    ),
  };
}

test.describe(
  'inventory consistency - pre Channel Manager readiness',
  () => {
    test.setTimeout(90_000);

    test(
      'prevents overlapping room assignment and restores availability after cancellation',
      async ({ page }) => {
        await loginAs(page, frontDeskEmail);

        const candidate =
          await discoverInventoryCandidate(page);

        let reservationA:
          | CreatedReservation
          | undefined;

        let reservationB:
          | CreatedReservation
          | undefined;

        try {
          reservationA =
            await createReservation(
              page,
              candidate,
              'Booking A',
            );

          reservationB =
            await createReservation(
              page,
              candidate,
              'Booking B',
            );

          await test.step(
            `Room ${candidate.roomNumber} starts available for ${candidate.arrivalDate} → ${candidate.departureDate}`,
            async () => {
              const roomIds =
                await getAvailableRoomIds(
                  page,
                  candidate,
                );

              expect(roomIds).toContain(
                candidate.roomId,
              );
            },
          );

          await test.step(
            'assign the room to Booking A',
            async () => {
              const response =
                await assignRoom(
                  page,
                  candidate,
                  reservationA!.id,
                );

              if (!response.ok) {
                throw new Error(
                  `Booking A room assignment failed: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
                );
              }
            },
          );

          await test.step(
            'assigned room disappears from overlapping availability',
            async () => {
              await expect
                .poll(
                  async () => {
                    const roomIds =
                      await getAvailableRoomIds(
                        page,
                        candidate,
                      );

                    return roomIds.includes(
                      candidate.roomId,
                    );
                  },
                  {
                    timeout: 15_000,
                    intervals: [
                      300,
                      700,
                      1_500,
                    ],
                  },
                )
                .toBe(false);
            },
          );

          await test.step(
            'backend rejects assigning the same room to overlapping Booking B',
            async () => {
              const response =
                await assignRoom(
                  page,
                  candidate,
                  reservationB!.id,
                );

              expect(response.ok).toBe(false);
              expect(response.status).toBe(400);

              const error = extractApiError(
                response.body,
              );

              expect(
                [
                  'ROOM_ALREADY_ASSIGNED',
                  'ROOM_ALREADY_OCCUPIED',
                ],
              ).toContain(error.code);

              expect(
                error.message.toLowerCase(),
              ).toMatch(
                /already assigned|overlapping|already occupied/,
              );
            },
          );

          await test.step(
            'cancel Booking A',
            async () => {
              const response =
                await cancelReservation(
                  page,
                  candidate,
                  reservationA!.id,
                );

              if (!response.ok) {
                throw new Error(
                  `Booking A cancellation failed: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
                );
              }
            },
          );

          await test.step(
            'room returns to inventory after Booking A cancellation',
            async () => {
              await expect
                .poll(
                  async () => {
                    const roomIds =
                      await getAvailableRoomIds(
                        page,
                        candidate,
                      );

                    return roomIds.includes(
                      candidate.roomId,
                    );
                  },
                  {
                    timeout: 15_000,
                    intervals: [
                      300,
                      700,
                      1_500,
                    ],
                  },
                )
                .toBe(true);
            },
          );

          await test.step(
            'Booking B can now receive the released room',
            async () => {
              const response =
                await assignRoom(
                  page,
                  candidate,
                  reservationB!.id,
                );

              if (!response.ok) {
                throw new Error(
                  `Booking B could not receive the released room: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
                );
              }
            },
          );
        } finally {
          // Keep repeated local E2E runs clean.
          if (reservationA?.id) {
            await cancelReservation(
              page,
              candidate,
              reservationA.id,
            ).catch(() => undefined);
          }

          if (reservationB?.id) {
            await cancelReservation(
              page,
              candidate,
              reservationB.id,
            ).catch(() => undefined);
          }
        }
      },
    );
  },
);
