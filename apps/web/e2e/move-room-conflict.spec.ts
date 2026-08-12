import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const frontDeskEmail = 'frontdesk@stayos.local';

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type LooseRecord = Record<string, unknown>;

type RoomTarget = {
  roomId: string;
  roomNumber: string;
};

type MoveCandidate = {
  propertyId: string;
  reservationId: string;
  guestId: string;
  currentRoomId: string;
  currentRoomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  targets: [RoomTarget, RoomTarget];
};

type CreatedReservation = {
  id: string;
};

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
        TValue | { data?: TValue } | { items?: TValue } | { results?: TValue };

      const unwrap = <TValue>(payload: ApiEnvelope<TValue>): TValue => {
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

        return payload as TValue;
      };

      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');

      if (!token) {
        throw new Error('No auth token available for move-room E2E API call.');
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
        body: response.ok ? unwrap<T>(rawBody) : (rawBody as T),
      };
    },
    {
      baseUrl: apiBaseUrl,
      request: input,
    },
  );
}

async function discoverMoveCandidate(page: Page): Promise<MoveCandidate> {
  const propertiesResponse = await apiRequest<LooseRecord[]>(page, {
    path: '/properties',
  });

  if (!propertiesResponse.ok) {
    throw new Error(`Unable to load properties: HTTP ${propertiesResponse.status}`);
  }

  const activeProperty =
    propertiesResponse.body.find(
      (property) => String(property.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE',
    ) ?? propertiesResponse.body[0];

  const propertyId = String(activeProperty?.id ?? '');

  if (!propertyId) {
    throw new Error('No active property found for move-room E2E test.');
  }

  const reservationsResponse = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/reservations?limit=100`,
  });

  if (!reservationsResponse.ok) {
    throw new Error(`Unable to load reservations: HTTP ${reservationsResponse.status}`);
  }

  const checkedIn = reservationsResponse.body
    .filter(
      (reservation) =>
        String(reservation.status ?? '').toUpperCase() === 'CHECKED_IN' &&
        Boolean(reservation.roomId) &&
        Boolean(reservation.roomTypeId) &&
        Boolean(reservation.guestId),
    )
    .map((reservation) => ({
      reservationId: String(reservation.id ?? reservation._id ?? reservation.uuid ?? ''),
      guestId: String(reservation.guestId ?? ''),
      currentRoomId: String(reservation.roomId ?? ''),
      roomTypeId: String(reservation.roomTypeId ?? ''),
      arrivalDate: String(reservation.arrivalDate ?? ''),
      departureDate: String(reservation.departureDate ?? ''),
      adults: Number(reservation.adults ?? 1),
      children: Number(reservation.children ?? 0),
    }))
    .filter(
      (candidate) =>
        candidate.reservationId &&
        candidate.guestId &&
        candidate.currentRoomId &&
        candidate.roomTypeId &&
        candidate.arrivalDate &&
        candidate.departureDate,
    );

  for (const candidate of checkedIn) {
    const roomBoardResponse = await apiRequest<LooseRecord[]>(page, {
      path: `/properties/${propertyId}/operations/room-board`,
    });

    if (!roomBoardResponse.ok) {
      continue;
    }

    const currentRoom = roomBoardResponse.body.find(
      (room) => String(room.roomId ?? room.id ?? '') === candidate.currentRoomId,
    );

    if (!currentRoom) {
      continue;
    }

    const currentRoomType = (currentRoom.roomType ?? {}) as LooseRecord;

    const roomTypeName = String(currentRoomType.name ?? currentRoomType.code ?? 'Room type');

    const currentRoomNumber = String(currentRoom.roomNumber ?? '');

    const query = new URLSearchParams({
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
      roomTypeId: candidate.roomTypeId,
      guestCount: String(candidate.adults + candidate.children),
      adults: String(candidate.adults),
      children: String(candidate.children),
    });

    const availableResponse = await apiRequest<LooseRecord[]>(page, {
      path: `/properties/${propertyId}/operations/available-rooms?${query.toString()}`,
    });

    if (!availableResponse.ok) {
      continue;
    }

    const targets = availableResponse.body
      .map((room) => ({
        roomId: String(room.roomId ?? room.id ?? ''),
        roomNumber: String(room.roomNumber ?? ''),
      }))
      .filter((room) => room.roomId && room.roomNumber && room.roomId !== candidate.currentRoomId);

    if (targets.length < 2) {
      continue;
    }

    return {
      propertyId,
      ...candidate,
      currentRoomNumber,
      roomTypeName,
      targets: [targets[0], targets[1]],
    };
  }

  throw new Error(
    'No CHECKED_IN reservation with at least two compatible Ready rooms was found for move-room conflict testing.',
  );
}

async function createConflictReservation(
  page: Page,
  candidate: MoveCandidate,
  target: RoomTarget,
): Promise<CreatedReservation> {
  const createResponse = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${candidate.propertyId}/reservations`,
    body: {
      guestId: candidate.guestId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
      adults: candidate.adults,
      children: candidate.children,
      roomTypeId: candidate.roomTypeId,
      source: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAYMENT_DUE',
      notes: 'E2E move-room conflict reservation',
    },
  });

  if (!createResponse.ok) {
    throw new Error(
      `Unable to create move-room conflict reservation: HTTP ${createResponse.status}\n${JSON.stringify(createResponse.body)}`,
    );
  }

  const id = String(
    createResponse.body.id ?? createResponse.body._id ?? createResponse.body.uuid ?? '',
  );

  if (!id) {
    throw new Error('Conflict reservation was created but no reservation id was returned.');
  }

  const assignResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${id}/assign-room`,
    body: {
      roomId: target.roomId,
    },
  });

  if (!assignResponse.ok) {
    throw new Error(
      `Unable to assign conflict Room ${target.roomNumber}: HTTP ${assignResponse.status}\n${JSON.stringify(assignResponse.body)}`,
    );
  }

  return { id };
}

async function moveRoom(page: Page, candidate: MoveCandidate, roomId: string, reason: string) {
  return apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/move-room`,
    body: {
      roomId,
      reason,
    },
  });
}

async function readReservation(page: Page, candidate: MoveCandidate): Promise<LooseRecord> {
  const response = await apiRequest<LooseRecord>(page, {
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read source reservation: HTTP ${response.status}`);
  }

  return response.body;
}

async function cleanupConflictReservation(
  page: Page,
  candidate: MoveCandidate,
  reservationId: string,
) {
  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${reservationId}/unassign-room`,
  }).catch(() => undefined);

  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${reservationId}`,
    body: {
      status: 'CANCELLED',
    },
  }).catch(() => undefined);
}

function extractApiError(body: LooseRecord) {
  const nested =
    body.error && typeof body.error === 'object' ? (body.error as LooseRecord) : undefined;

  return {
    code: String(nested?.code ?? body.code ?? ''),
    message: String(nested?.message ?? body.message ?? ''),
  };
}

test.describe('move room conflict - pre Channel Manager readiness', () => {
  test.setTimeout(90_000);

  test('rejects an overlapping target room, then moves the in-house guest to a valid room', async ({
    page,
  }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverMoveCandidate(page);

    const [conflictTarget, validTarget] = candidate.targets;

    const conflictReservation = await createConflictReservation(page, candidate, conflictTarget);

    let conflictCleaned = false;

    try {
      await test.step('source stay starts in the original occupied room', async () => {
        const current = await readReservation(page, candidate);

        expect(String(current.status ?? '').toUpperCase()).toBe('CHECKED_IN');

        expect(String(current.roomId ?? '')).toBe(candidate.currentRoomId);
      });

      await test.step(`reject move into overlapping Room ${conflictTarget.roomNumber}`, async () => {
        const response = await moveRoom(
          page,
          candidate,
          conflictTarget.roomId,
          'E2E conflict validation',
        );

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);

        const error = extractApiError(response.body);

        expect(['ROOM_OVERLAP', 'ROOM_ALREADY_ASSIGNED', 'ROOM_ALREADY_OCCUPIED']).toContain(
          error.code,
        );

        expect(error.message.toLowerCase()).toMatch(/overlap|already assigned|already occupied/);
      });

      await test.step('failed move leaves source guest in the original room', async () => {
        const current = await readReservation(page, candidate);

        expect(String(current.status ?? '').toUpperCase()).toBe('CHECKED_IN');

        expect(String(current.roomId ?? '')).toBe(candidate.currentRoomId);
      });

      await test.step(`move guest successfully to Room ${validTarget.roomNumber}`, async () => {
        const response = await moveRoom(
          page,
          candidate,
          validTarget.roomId,
          'E2E valid move-room lifecycle',
        );

        if (!response.ok) {
          throw new Error(
            `Expected move to Room ${validTarget.roomNumber} to succeed, but received HTTP ${response.status}\n${JSON.stringify(response.body)}`,
          );
        }

        await expect
          .poll(
            async () => {
              const current = await readReservation(page, candidate);

              return String(current.roomId ?? '');
            },
            {
              timeout: 15_000,
              intervals: [300, 700, 1_500],
            },
          )
          .toBe(validTarget.roomId);
      });

      await test.step('room move is persisted and source stay no longer points to the old room', async () => {
        await expect
          .poll(
            async () => {
              const current = await readReservation(page, candidate);

              return {
                roomId: String(current.roomId ?? ''),
                status: String(current.status ?? '').toUpperCase(),
              };
            },
            {
              timeout: 15_000,
              intervals: [300, 700, 1_500],
            },
          )
          .toEqual({
            roomId: validTarget.roomId,
            status: 'CHECKED_IN',
          });

        expect(validTarget.roomId).not.toBe(candidate.currentRoomId);
      });

      await test.step('source reservation remains checked in after the move', async () => {
        const current = await readReservation(page, candidate);

        expect(String(current.status ?? '').toUpperCase()).toBe('CHECKED_IN');

        expect(String(current.roomId ?? '')).toBe(validTarget.roomId);
      });

      await test.step('clean up temporary conflict reservation', async () => {
        await cleanupConflictReservation(page, candidate, conflictReservation.id);

        conflictCleaned = true;
      });
    } finally {
      if (!conflictCleaned) {
        await cleanupConflictReservation(page, candidate, conflictReservation.id);
      }
    }
  });
});
