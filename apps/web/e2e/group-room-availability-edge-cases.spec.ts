import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty, resetE2EPropertyState } from './helpers/e2e-property';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const MANAGER_EMAIL =
  process.env.E2E_MANAGER_EMAIL ?? process.env.E2E_EMAIL ?? 'manager@stayos.local';

const arrivalDate = '2026-08-12';
const departureDate = '2026-08-14';

type ApiEnvelope<T> = { success: boolean; data: T };
type AvailableRoomDto = {
  roomId: string;
  roomNumber: string;
  roomType: { id: string; name?: string };
};
type GroupHoldDto = {
  id: string;
  groupCode: string;
  roomAssignments: Array<{
    id: string;
    roomId: string;
    roomNumber: string;
  }>;
};

type ApiAttempt = {
  body: string;
  ok: boolean;
  status: number;
};

async function accessToken(page: Page) {
  const token = await page.evaluate(
    () =>
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken'),
  );
  if (!token) throw new Error('No StayOS access token found after login.');
  return token;
}

async function api<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await accessToken(page);
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  });
  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as ApiEnvelope<T> | T) : undefined;
  if (!response.ok()) throw new Error(`${method} ${path} failed (${response.status()}): ${raw}`);
  if (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed) {
    return (parsed as ApiEnvelope<T>).data;
  }
  return parsed as T;
}

async function apiAttempt(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<ApiAttempt> {
  const token = await accessToken(page);
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  });

  return {
    body: await response.text(),
    ok: response.ok(),
    status: response.status(),
  };
}

async function createGuest(page: Page, propertyId: string, suffix: string) {
  const charSum = [...suffix].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const phoneSeed = `${suffix.replace(/\D/g, '')}${charSum}`.slice(-9).padStart(9, '0');
  const phone = `9${phoneSeed}`;
  const guest = await api<{ id: string }>(page, 'POST', `/properties/${propertyId}/guests`, {
    firstName: 'E2E',
    lastName: `Edge${suffix}`,
    phone,
    email: `e2e.group.edge.${suffix}@example.com`,
    nationality: 'Indian',
  });
  return guest.id;
}

async function createReservation(
  page: Page,
  input: {
    propertyId: string;
    guestId: string;
    roomTypeId: string;
    roomId: string;
    arrivalDate: string;
    departureDate: string;
  },
) {
  return api<{ id: string }>(page, 'POST', `/properties/${input.propertyId}/reservations`, {
    guestId: input.guestId,
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    adults: 1,
    children: 0,
    roomTypeId: input.roomTypeId,
    roomId: input.roomId,
    source: 'DIRECT',
    status: 'CONFIRMED',
    paymentStatus: 'PAYMENT_DUE',
    notes: 'E2E group room availability edge case',
  });
}

async function cancelReservationBestEffort(
  page: Page,
  propertyId: string | undefined,
  reservationId: string | undefined,
) {
  if (!propertyId || !reservationId) return;
  try {
    await api(page, 'PATCH', `/properties/${propertyId}/reservations/${reservationId}`, {
      status: 'CANCELLED',
    });
  } catch {
    // Cleanup should not hide the test result.
  }
}

async function createGroupHold(page: Page, propertyId: string, roomTypeId: string, suffix: string) {
  return api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds`, {
    adults: 2,
    arrivalDate,
    children: 0,
    departureDate,
    depositRequired: 0,
    groupName: `E2E Edge Group ${suffix}`,
    leadName: 'E2E Group Lead',
    leadPhone: '9999999999',
    notes: 'E2E group room availability edge case',
    roomBlocks: [{ adultsPerRoom: 2, childrenPerRoom: 0, roomTypeId, rooms: 1 }],
    source: 'PHONE',
  });
}

async function assignGroupRoom(
  page: Page,
  propertyId: string,
  groupHoldId: string,
  roomId: string,
) {
  return api<GroupHoldDto>(
    page,
    'POST',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/room-assignments`,
    { roomId },
  );
}

async function changeGroupRoom(
  page: Page,
  propertyId: string,
  groupHoldId: string,
  assignmentId: string,
  roomId: string,
) {
  return api<GroupHoldDto>(
    page,
    'PATCH',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/room-assignments/${assignmentId}`,
    { roomId },
  );
}

async function cancelGroupBestEffort(
  page: Page,
  propertyId: string | undefined,
  groupHoldId: string | undefined,
) {
  if (!propertyId || !groupHoldId) return;
  try {
    await api(
      page,
      'POST',
      `/properties/${propertyId}/operations/group-holds/${groupHoldId}/cancel`,
      {},
    );
  } catch {
    // Cleanup should not hide the test result.
  }
}

async function availableRooms(page: Page, propertyId: string, roomTypeId: string) {
  const query = new URLSearchParams({ arrivalDate, departureDate, roomTypeId });
  return api<AvailableRoomDto[]>(
    page,
    'GET',
    `/properties/${propertyId}/operations/available-rooms?${query.toString()}`,
  );
}

async function roomChangeCandidates(
  page: Page,
  propertyId: string,
  groupHoldId: string,
  assignmentId: string,
) {
  return api<AvailableRoomDto[]>(
    page,
    'GET',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/room-assignments/${assignmentId}/change-candidates`,
  );
}

async function markRoom(page: Page, propertyId: string, roomId: string, action: string) {
  return api(page, 'PATCH', `/properties/${propertyId}/rooms/${roomId}/${action}`, {
    reason: 'E2E group room availability edge case',
    note: 'E2E controlled unavailable room',
  });
}

async function markReadyBestEffort(
  page: Page,
  propertyId: string | undefined,
  roomId: string | undefined,
) {
  if (!propertyId || !roomId) return;
  try {
    await api(page, 'PATCH', `/properties/${propertyId}/rooms/${roomId}/mark-ready`);
  } catch {
    // Cleanup should not hide the test result.
  }
}

test.describe('group room availability edge cases', () => {
  test('same-day arrival is available while true conflicts are excluded', async ({ page }) => {
    test.setTimeout(180_000);
    resetE2EPropertyState();

    let propertyId: string | undefined;
    let primaryGroupId: string | undefined;
    const reservationIds: string[] = [];
    const statusRoomIds: string[] = [];

    await loginAs(page, MANAGER_EMAIL);

    try {
      const fixture = await ensureE2EProperty(page);
      propertyId = fixture.id;
      const suffix = 'FIXED';
      const deluxeType = fixture.roomTypes.E2E_DLX;
      const currentRoom = fixture.rooms.E201;
      const boundaryRoom = fixture.rooms.E202;
      const readyRoom = fixture.rooms.E203;
      const occupiedRoom = fixture.rooms.E204;
      const inspectionRoom = fixture.rooms.E205;
      const wrongRoom = fixture.rooms.E206;

      statusRoomIds.push(inspectionRoom.id);

      const boundaryGuestId = await createGuest(page, propertyId, `${suffix}B`);
      const boundaryReservation = await createReservation(page, {
        propertyId,
        guestId: boundaryGuestId,
        roomTypeId: deluxeType.id,
        roomId: boundaryRoom.id,
        arrivalDate: '2026-08-14',
        departureDate: '2026-08-16',
      });
      reservationIds.push(boundaryReservation.id);

      const occupiedGuestId = await createGuest(page, propertyId, `${suffix}D`);
      const occupiedReservation = await createReservation(page, {
        propertyId,
        guestId: occupiedGuestId,
        roomTypeId: deluxeType.id,
        roomId: occupiedRoom.id,
        arrivalDate: '2026-08-12',
        departureDate: '2026-08-14',
      });
      reservationIds.push(occupiedReservation.id);

      await markRoom(page, propertyId, inspectionRoom.id, 'mark-inspection');

      const primaryGroup = await createGroupHold(page, propertyId, deluxeType.id, suffix);
      primaryGroupId = primaryGroup.id;
      const assigned = await assignGroupRoom(page, propertyId, primaryGroup.id, currentRoom.id);
      expect(assigned.roomAssignments).toHaveLength(1);

      const canonical = await availableRooms(page, propertyId, deluxeType.id);
      const canonicalRoomIds = new Set(canonical.map((room) => room.roomId));

      expect(canonicalRoomIds.has(boundaryRoom.id)).toBeTruthy();
      expect(canonicalRoomIds.has(readyRoom.id)).toBeTruthy();
      expect(canonicalRoomIds.has(currentRoom.id)).toBeFalsy();
      expect(canonicalRoomIds.has(occupiedRoom.id)).toBeFalsy();
      expect(canonicalRoomIds.has(inspectionRoom.id)).toBeFalsy();
      expect(canonicalRoomIds.has(wrongRoom.id)).toBeFalsy();

      // Boundary proof: the reservation starts exactly on the requested departure date.
      expect(boundaryReservation.id).toBeTruthy();

      const candidates = await roomChangeCandidates(
        page,
        propertyId,
        primaryGroup.id,
        assigned.roomAssignments[0].id,
      );
      const candidateRoomIds = new Set(candidates.map((room) => room.roomId));
      expect(candidateRoomIds.has(boundaryRoom.id)).toBeTruthy();
      expect(candidateRoomIds.has(readyRoom.id)).toBeTruthy();
      expect(candidateRoomIds.has(currentRoom.id)).toBeFalsy();
      expect(candidateRoomIds.has(occupiedRoom.id)).toBeFalsy();
      expect(candidateRoomIds.has(inspectionRoom.id)).toBeFalsy();
      expect(candidateRoomIds.has(wrongRoom.id)).toBeFalsy();

      const controlledRooms = [
        currentRoom,
        boundaryRoom,
        readyRoom,
        occupiedRoom,
        inspectionRoom,
        wrongRoom,
      ];
      const expectedVisible = controlledRooms.filter((room) => candidateRoomIds.has(room.id));
      expect(expectedVisible.map((room) => room.id).sort()).toEqual(
        [boundaryRoom.id, readyRoom.id].sort(),
      );

      const occupiedAttempt = await apiAttempt(
        page,
        'PATCH',
        `/properties/${propertyId}/operations/group-holds/${primaryGroup.id}/room-assignments/${assigned.roomAssignments[0].id}`,
        { roomId: occupiedRoom.id },
      );
      expect(occupiedAttempt.ok).toBeFalsy();
      expect(occupiedAttempt.status).toBeGreaterThanOrEqual(400);

      await changeGroupRoom(
        page,
        propertyId,
        primaryGroup.id,
        assigned.roomAssignments[0].id,
        readyRoom.id,
      );

      const afterChange = await api<GroupHoldDto>(
        page,
        'GET',
        `/properties/${propertyId}/operations/group-holds/${primaryGroup.id}`,
      );
      expect(afterChange.roomAssignments).toHaveLength(1);
      expect(afterChange.roomAssignments[0].roomId).toBe(readyRoom.id);
      expect(
        afterChange.roomAssignments.some((assignment) => assignment.roomId === currentRoom.id),
      ).toBeFalsy();
      expect(
        afterChange.roomAssignments.filter((assignment) => assignment.roomId === readyRoom.id),
      ).toHaveLength(1);
    } finally {
      await cancelGroupBestEffort(page, propertyId, primaryGroupId);
      for (const reservationId of reservationIds) {
        await cancelReservationBestEffort(page, propertyId, reservationId);
      }
      for (const roomId of statusRoomIds) {
        await markReadyBestEffort(page, propertyId, roomId);
      }
      resetE2EPropertyState();
    }
  });
});
