import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const MANAGER_EMAIL =
  process.env.E2E_MANAGER_EMAIL ?? process.env.E2E_EMAIL ?? 'manager@stayos.local';

const arrivalDate = '2026-08-12';
const departureDate = '2026-08-14';

type ApiEnvelope<T> = { success: boolean; data: T };
type PropertyDto = { id: string; status?: string };
type FloorDto = { id: string };
type RoomTypeDto = { id: string; code: string; name: string };
type RoomDto = {
  id: string;
  roomNumber: string;
  roomType?: { id?: string; name?: string };
  roomTypeId?: string;
};
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

async function activeProperty(page: Page) {
  const properties = await api<PropertyDto[]>(page, 'GET', '/properties');
  const property =
    properties.find((item) => String(item.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
    properties[0];
  if (!property?.id) throw new Error('No active property found.');
  return property;
}

async function createRoomType(page: Page, propertyId: string, input: { code: string; name: string }) {
  return api<RoomTypeDto>(page, 'POST', `/properties/${propertyId}/room-types`, {
    code: input.code,
    name: input.name,
    baseOccupancy: 2,
    maxOccupancy: 3,
    maxAdults: 2,
    maxChildren: 1,
    bedType: 'King',
    sizeSqFt: 320,
  });
}

async function createRoom(
  page: Page,
  propertyId: string,
  input: { floorId: string; roomTypeId: string; roomNumber: string },
) {
  return api<RoomDto>(page, 'POST', `/properties/${propertyId}/rooms`, {
    floorId: input.floorId,
    roomTypeId: input.roomTypeId,
    roomNumber: input.roomNumber,
    displayName: input.roomNumber,
    operationalStatus: 'READY',
  });
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

async function createGroupHold(
  page: Page,
  propertyId: string,
  roomTypeId: string,
  suffix: string,
) {
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

async function assignGroupRoom(page: Page, propertyId: string, groupHoldId: string, roomId: string) {
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
    await api(page, 'POST', `/properties/${propertyId}/operations/group-holds/${groupHoldId}/cancel`, {});
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

function roomOption(page: Page, room: RoomDto) {
  return page.getByRole('option').filter({ hasText: new RegExp(`^${room.roomNumber}\\s+-`) });
}

test.describe('group room availability edge cases', () => {
  test('same-day arrival is available while true conflicts are excluded', async ({ page }) => {
    test.setTimeout(180_000);

    let propertyId: string | undefined;
    let primaryGroupId: string | undefined;
    let conflictGroupId: string | undefined;
    const reservationIds: string[] = [];
    const statusRoomIds: string[] = [];

    await loginAs(page, MANAGER_EMAIL);

    try {
      const property = await activeProperty(page);
      propertyId = property.id;
      const suffix = String(Date.now()).slice(-8);
      const floors = await api<FloorDto[]>(page, 'GET', `/properties/${propertyId}/floors`);
      const floorId = floors[0]?.id;
      if (!floorId) throw new Error('No floor found for E2E room creation.');

      const deluxeType = await createRoomType(page, propertyId, {
        code: `GED${suffix}`,
        name: `Deluxe Edge ${suffix}`,
      });
      const wrongType = await createRoomType(page, propertyId, {
        code: `GEW${suffix}`,
        name: `Suite Edge ${suffix}`,
      });

      const [currentRoom, boundaryRoom, readyRoom, occupiedRoom, inspectionRoom, oosRoom, groupRoom] =
        await Promise.all(
          ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((label) =>
            createRoom(page, propertyId as string, {
              floorId,
              roomTypeId: deluxeType.id,
              roomNumber: `GE${suffix}${label}`,
            }),
          ),
        );
      const wrongRoom = await createRoom(page, propertyId, {
        floorId,
        roomTypeId: wrongType.id,
        roomNumber: `GE${suffix}W`,
      });

      statusRoomIds.push(inspectionRoom.id, oosRoom.id);

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
      await markRoom(page, propertyId, oosRoom.id, 'out-of-service');

      const conflictGroup = await createGroupHold(page, propertyId, deluxeType.id, `${suffix}X`);
      conflictGroupId = conflictGroup.id;
      await assignGroupRoom(page, propertyId, conflictGroup.id, groupRoom.id);

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
      expect(canonicalRoomIds.has(oosRoom.id)).toBeFalsy();
      expect(canonicalRoomIds.has(groupRoom.id)).toBeFalsy();
      expect(canonicalRoomIds.has(wrongRoom.id)).toBeFalsy();

      // Boundary proof: the reservation starts exactly on the requested departure date.
      expect(boundaryReservation.id).toBeTruthy();

      await page.goto(`/reservations/group-holds/${primaryGroup.id}`);
      await expect(page.getByText(primaryGroup.groupCode)).toBeVisible({ timeout: 20_000 });

      const assignedRoomCard = page
        .locator('div')
        .filter({ has: page.getByText(`Room ${currentRoom.roomNumber}`, { exact: true }) })
        .filter({ has: page.getByRole('button', { name: 'Change Room' }) })
        .last();
      await expect(assignedRoomCard).toBeVisible({ timeout: 15_000 });
      await assignedRoomCard.getByRole('button', { name: 'Change Room' }).click();

      const modal = page.getByRole('dialog', { name: 'Change Room' });
      await expect(modal).toBeVisible();
      await modal.getByLabel('Replacement room').click();

      await expect(roomOption(page, boundaryRoom)).toBeVisible();
      await expect(roomOption(page, readyRoom)).toBeVisible();
      await expect(roomOption(page, currentRoom)).toHaveCount(0);
      await expect(roomOption(page, occupiedRoom)).toHaveCount(0);
      await expect(roomOption(page, inspectionRoom)).toHaveCount(0);
      await expect(roomOption(page, oosRoom)).toHaveCount(0);
      await expect(roomOption(page, groupRoom)).toHaveCount(0);
      await expect(roomOption(page, wrongRoom)).toHaveCount(0);

      const controlledRooms = [
        currentRoom,
        boundaryRoom,
        readyRoom,
        occupiedRoom,
        inspectionRoom,
        oosRoom,
        groupRoom,
        wrongRoom,
      ];
      const expectedVisible = controlledRooms.filter((room) => canonicalRoomIds.has(room.id));
      expect(expectedVisible.map((room) => room.id).sort()).toEqual(
        [boundaryRoom.id, readyRoom.id].sort(),
      );

      const boundaryAttempt = await apiAttempt(
        page,
        'PATCH',
        `/properties/${propertyId}/operations/group-holds/${primaryGroup.id}/room-assignments/${assigned.roomAssignments[0].id}`,
        { roomId: boundaryRoom.id },
      );
      expect(boundaryAttempt.ok).toBeFalsy();
      expect(boundaryAttempt.status).toBeGreaterThanOrEqual(400);

      await roomOption(page, readyRoom).click();
      const changeResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes(`/operations/group-holds/${primaryGroup.id}/room-assignments/`),
      );
      await modal.getByRole('button', { name: 'Change Room' }).click();
      const response = await changeResponse;
      const responseBody = await response.text();
      expect(response.ok(), responseBody).toBeTruthy();

      const afterChange = await api<GroupHoldDto>(
        page,
        'GET',
        `/properties/${propertyId}/operations/group-holds/${primaryGroup.id}`,
      );
      expect(afterChange.roomAssignments).toHaveLength(1);
      expect(afterChange.roomAssignments[0].roomId).toBe(readyRoom.id);
      expect(afterChange.roomAssignments.some((assignment) => assignment.roomId === currentRoom.id))
        .toBeFalsy();
      expect(afterChange.roomAssignments.filter((assignment) => assignment.roomId === readyRoom.id))
        .toHaveLength(1);
    } finally {
      await cancelGroupBestEffort(page, propertyId, primaryGroupId);
      await cancelGroupBestEffort(page, propertyId, conflictGroupId);
      for (const reservationId of reservationIds) {
        await cancelReservationBestEffort(page, propertyId, reservationId);
      }
      for (const roomId of statusRoomIds) {
        await markReadyBestEffort(page, propertyId, roomId);
      }
    }
  });
});
