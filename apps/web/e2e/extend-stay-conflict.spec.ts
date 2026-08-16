import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty } from './helpers/e2e-property';

const frontDeskEmail = 'frontdesk@stayos.local';

const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type LooseRecord = Record<string, unknown>;

type ExtendCandidate = {
  propertyId: string;
  reservationId: string;
  guestId: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
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
        throw new Error('No auth token available for extend-stay E2E API call.');
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

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function discoverExtendCandidate(page: Page): Promise<ExtendCandidate> {
  const propertyId = (await ensureE2EProperty(page)).id;

  const reservationsResponse = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/reservations?limit=100`,
  });

  if (!reservationsResponse.ok) {
    throw new Error(`Unable to load reservations: HTTP ${reservationsResponse.status}`);
  }

  const confirmedWithRoom = reservationsResponse.body
    .filter(
      (reservation) =>
        String(reservation.status ?? '').toUpperCase() === 'CONFIRMED' &&
        Boolean(reservation.roomId) &&
        Boolean(reservation.roomTypeId) &&
        Boolean(reservation.guestId),
    )
    .map((reservation) => ({
      reservationId: String(reservation.id ?? reservation._id ?? reservation.uuid ?? ''),
      guestId: String(reservation.guestId ?? ''),
      roomId: String(reservation.roomId ?? ''),
      roomTypeId: String(reservation.roomTypeId ?? ''),
      arrivalDate: String(reservation.arrivalDate ?? ''),
      departureDate: String(reservation.departureDate ?? ''),
    }))
    .filter(
      (candidate) =>
        candidate.reservationId &&
        candidate.roomId &&
        candidate.roomTypeId &&
        candidate.guestId &&
        candidate.arrivalDate &&
        candidate.departureDate,
    );

  for (const candidate of confirmedWithRoom) {
    const workspaceResponse = await apiRequest<LooseRecord>(page, {
      path: `/properties/${propertyId}/reservations/${candidate.reservationId}/check-in-workspace`,
    });

    if (!workspaceResponse.ok) {
      continue;
    }

    const room = (workspaceResponse.body.room ?? {}) as LooseRecord;

    if (room.readyForCheckIn !== true) {
      continue;
    }

    // The conflict fixture needs this SAME physical room to be free
    // immediately after the current reservation's departure.
    // Without this check we can accidentally pick a seeded reservation
    // whose room is already committed to another future booking, causing
    // the boundary reservation setup itself to fail before we test extend.
    const boundaryDeparture = addDays(candidate.departureDate, 2);

    const availabilityQuery = new URLSearchParams({
      arrivalDate: candidate.departureDate,
      departureDate: boundaryDeparture,
      roomTypeId: candidate.roomTypeId,
      guestCount: '1',
      adults: '1',
      children: '0',
    });

    const availableRoomsResponse = await apiRequest<LooseRecord[]>(page, {
      path: `/properties/${propertyId}/operations/available-rooms?${availabilityQuery.toString()}`,
    });

    if (!availableRoomsResponse.ok) {
      continue;
    }

    const sameRoomIsFreeAfterDeparture = availableRoomsResponse.body.some(
      (availableRoom) =>
        String(availableRoom.roomId ?? availableRoom.id ?? '') === candidate.roomId,
    );

    if (!sameRoomIsFreeAfterDeparture) {
      continue;
    }

    return {
      propertyId,
      ...candidate,
      roomNumber: String(room.roomNumber ?? ''),
    };
  }

  throw new Error(
    'No CONFIRMED reservation with an assigned Ready room and free post-departure inventory was found for extend-stay conflict testing.',
  );
}

async function createBoundaryReservation(
  page: Page,
  candidate: ExtendCandidate,
): Promise<CreatedReservation> {
  const conflictArrival = candidate.departureDate;
  const conflictDeparture = addDays(candidate.departureDate, 2);

  const createResponse = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${candidate.propertyId}/reservations`,
    body: {
      guestId: candidate.guestId,
      arrivalDate: conflictArrival,
      departureDate: conflictDeparture,
      adults: 1,
      children: 0,
      roomTypeId: candidate.roomTypeId,
      source: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAYMENT_DUE',
      notes: 'E2E extend-stay boundary reservation',
    },
  });

  if (!createResponse.ok) {
    throw new Error(
      `Unable to create boundary reservation: HTTP ${createResponse.status}\n${JSON.stringify(createResponse.body)}`,
    );
  }

  const id = String(
    createResponse.body.id ?? createResponse.body._id ?? createResponse.body.uuid ?? '',
  );

  if (!id) {
    throw new Error('Boundary reservation was created but no id was returned.');
  }

  const assignResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${id}/assign-room`,
    body: {
      roomId: candidate.roomId,
    },
  });

  if (!assignResponse.ok) {
    throw new Error(
      `Unable to assign Room ${candidate.roomNumber} to boundary reservation: HTTP ${assignResponse.status}\n${JSON.stringify(assignResponse.body)}`,
    );
  }

  return { id };
}

async function prepareCheckIn(page: Page, candidate: ExtendCandidate) {
  const workspaceResponse = await apiRequest<LooseRecord>(page, {
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/check-in-workspace`,
  });

  if (!workspaceResponse.ok) {
    throw new Error(`Unable to load check-in workspace: HTTP ${workspaceResponse.status}`);
  }

  const guest = (workspaceResponse.body.guest ?? {}) as LooseRecord;

  const uniquePhone = `9${Date.now().toString().slice(-9)}`;

  const registrationResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/check-in/guest-registration`,
    body: {
      fullName: String(guest.fullName ?? '').trim() || 'E2E Extend Stay Guest',
      mobile: String(guest.mobile ?? '').trim() || uniquePhone,
      nationality: 'Indian',
      addressLine1: String(guest.address ?? '').trim() || 'E2E Test Address',
      city: String(guest.city ?? '').trim() || 'Indore',
      state: String(guest.state ?? '').trim() || 'Madhya Pradesh',
      country: String(guest.country ?? '').trim() || 'India',
      purposeOfVisit: String(guest.purposeOfVisit ?? '').trim() || 'Leisure',
      isForeignNational: false,
    },
  });

  if (!registrationResponse.ok) {
    throw new Error(
      `Guest registration preparation failed: HTTP ${registrationResponse.status}\n${JSON.stringify(registrationResponse.body)}`,
    );
  }

  const identityResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/check-in/identity`,
    body: {
      idType: 'AADHAAR',
      idNumber: '123456789012',
      verified: true,
    },
  });

  if (!identityResponse.ok) {
    throw new Error(
      `Identity preparation failed: HTTP ${identityResponse.status}\n${JSON.stringify(identityResponse.body)}`,
    );
  }

  const paymentResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/check-in/payment-review`,
    body: {
      paymentReviewed: true,
      paymentMethod: 'CASH',
      notes: 'Reviewed by E2E extend-stay lifecycle test',
    },
  });

  if (!paymentResponse.ok) {
    throw new Error(
      `Payment review preparation failed: HTTP ${paymentResponse.status}\n${JSON.stringify(paymentResponse.body)}`,
    );
  }

  const checkInResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/check-in`,
  });

  if (!checkInResponse.ok) {
    throw new Error(
      `Check-in preparation failed: HTTP ${checkInResponse.status}\n${JSON.stringify(checkInResponse.body)}`,
    );
  }
}

async function readReservation(page: Page, candidate: ExtendCandidate): Promise<LooseRecord> {
  const response = await apiRequest<LooseRecord>(page, {
    path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read reservation: HTTP ${response.status}`);
  }

  return response.body;
}

async function unassignBoundaryReservation(
  page: Page,
  candidate: ExtendCandidate,
  reservationId: string,
) {
  return apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${reservationId}/unassign-room`,
  });
}

async function cancelBoundaryReservation(
  page: Page,
  candidate: ExtendCandidate,
  reservationId: string,
) {
  return apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${candidate.propertyId}/reservations/${reservationId}`,
    body: {
      status: 'CANCELLED',
    },
  });
}

function extractApiError(body: LooseRecord) {
  const nested =
    body.error && typeof body.error === 'object' ? (body.error as LooseRecord) : undefined;

  return {
    code: String(nested?.code ?? body.code ?? ''),
    message: String(nested?.message ?? body.message ?? ''),
  };
}

test.describe('extend stay conflict - pre Channel Manager readiness', () => {
  test.setTimeout(90_000);

  test('blocks conflicting extension, preserves original date, then succeeds after inventory is released', async ({
    page,
  }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverExtendCandidate(page);

    const originalDepartureDate = candidate.departureDate;

    const requestedDepartureDate = addDays(originalDepartureDate, 1);

    const boundaryReservation = await createBoundaryReservation(page, candidate);

    let boundaryCancelled = false;

    try {
      await test.step('check in the source reservation', async () => {
        await prepareCheckIn(page, candidate);

        const current = await readReservation(page, candidate);

        expect(String(current.status ?? '').toUpperCase()).toBe('CHECKED_IN');

        expect(String(current.departureDate ?? '')).toBe(originalDepartureDate);
      });

      await test.step(`reject extension into Room ${candidate.roomNumber} future reservation`, async () => {
        const response = await apiRequest<LooseRecord>(page, {
          method: 'PATCH',
          path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/extend`,
          body: {
            departureDate: requestedDepartureDate,
          },
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);

        const error = extractApiError(response.body);

        expect(error.code).toBe('ROOM_ALREADY_ASSIGNED');

        expect(error.message.toLowerCase()).toContain('overlapping reservation');
      });

      await test.step('failed extension leaves departure date unchanged', async () => {
        const current = await readReservation(page, candidate);

        expect(String(current.departureDate ?? '')).toBe(originalDepartureDate);

        expect(String(current.status ?? '').toUpperCase()).toBe('CHECKED_IN');
      });

      await test.step('release the future reservation', async () => {
        // Once the source guest is checked in, this physical room is OCCUPIED.
        // Generic reservation PATCH validation requires an assigned room to be READY,
        // so cancelling the future reservation while it is still assigned would fail.
        // Remove the future room assignment first, then cancel the reservation.
        const unassignResponse = await unassignBoundaryReservation(
          page,
          candidate,
          boundaryReservation.id,
        );

        if (!unassignResponse.ok) {
          throw new Error(
            `Unable to unassign boundary reservation room: HTTP ${unassignResponse.status}\n${JSON.stringify(unassignResponse.body)}`,
          );
        }

        const cancelResponse = await cancelBoundaryReservation(
          page,
          candidate,
          boundaryReservation.id,
        );

        if (!cancelResponse.ok) {
          throw new Error(
            `Unable to cancel boundary reservation: HTTP ${cancelResponse.status}\n${JSON.stringify(cancelResponse.body)}`,
          );
        }

        boundaryCancelled = true;
      });

      await test.step('same extension succeeds after conflicting inventory is released', async () => {
        const response = await apiRequest<LooseRecord>(page, {
          method: 'PATCH',
          path: `/properties/${candidate.propertyId}/reservations/${candidate.reservationId}/extend`,
          body: {
            departureDate: requestedDepartureDate,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Expected extension to succeed after release, but received HTTP ${response.status}\n${JSON.stringify(response.body)}`,
          );
        }

        await expect
          .poll(
            async () => {
              const current = await readReservation(page, candidate);

              return String(current.departureDate ?? '');
            },
            {
              timeout: 15_000,
              intervals: [300, 700, 1_500],
            },
          )
          .toBe(requestedDepartureDate);
      });

      await test.step('reservation remains checked in after successful extension', async () => {
        const current = await readReservation(page, candidate);

        expect(String(current.status ?? '').toUpperCase()).toBe('CHECKED_IN');

        expect(String(current.departureDate ?? '')).toBe(requestedDepartureDate);
      });
    } finally {
      if (!boundaryCancelled) {
        // Best-effort cleanup for repeated local runs.
        // The room may already be OCCUPIED by the source stay, so unassign first.
        await unassignBoundaryReservation(page, candidate, boundaryReservation.id).catch(
          () => undefined,
        );

        await cancelBoundaryReservation(page, candidate, boundaryReservation.id).catch(
          () => undefined,
        );
      }
    }
  });
});
