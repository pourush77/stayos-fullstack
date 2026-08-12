import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const FRONT_DESK_EMAIL =
  process.env.E2E_FRONT_DESK_EMAIL ?? process.env.E2E_EMAIL ?? 'frontdesk@stayos.local';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type PropertyDto = {
  id: string;
  status?: string;
};

type AvailableRoomDto = {
  roomId: string;
  roomNumber: string;
  roomType: {
    id: string;
    code?: string;
    name?: string;
  };
};

type GroupHoldDto = {
  id: string;
  groupCode: string;
  status: string;
  roomAssignments: Array<{
    id: string;
    roomId: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
  }>;
};

async function accessToken(page: Page) {
  const token = await page.evaluate(
    () =>
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken'),
  );

  if (!token) {
    throw new Error('No StayOS access token found after login.');
  }

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
  let parsed: ApiEnvelope<T> | T | undefined;

  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    throw new Error(`${method} ${path} returned non-JSON (${response.status()}): ${raw}`);
  }

  if (!response.ok()) {
    throw new Error(`${method} ${path} failed (${response.status()}): ${raw}`);
  }

  if (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed) {
    return (parsed as ApiEnvelope<T>).data;
  }

  return parsed as T;
}

function dateValue(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function activeProperty(page: Page) {
  const properties = await api<PropertyDto[]>(page, 'GET', '/properties');
  const property =
    properties.find((item) => String(item.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
    properties[0];

  if (!property?.id) {
    throw new Error('No active property found for group-room reassignment E2E.');
  }

  return property;
}

async function availableRooms(
  page: Page,
  propertyId: string,
  arrivalDate: string,
  departureDate: string,
) {
  const query = new URLSearchParams({ arrivalDate, departureDate });

  return api<AvailableRoomDto[]>(
    page,
    'GET',
    `/properties/${propertyId}/operations/available-rooms?${query.toString()}`,
  );
}

function pickSameTypeRoomPair(rooms: AvailableRoomDto[]) {
  const byType = new Map<string, AvailableRoomDto[]>();

  for (const room of rooms) {
    const roomTypeId = room.roomType.id;
    const current = byType.get(roomTypeId) ?? [];
    current.push(room);
    byType.set(roomTypeId, current);
  }

  const pair = [...byType.values()].find((items) => items.length >= 2);

  if (!pair) {
    throw new Error(
      'Could not find two compatible available rooms of the same room type. Reset/seed local E2E inventory and rerun.',
    );
  }

  return [pair[0], pair[1]] as const;
}

async function createOneRoomGroupHold(
  page: Page,
  propertyId: string,
  arrivalDate: string,
  departureDate: string,
  roomTypeId: string,
) {
  const unique = Date.now();

  return api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds`, {
    adults: 2,
    arrivalDate,
    children: 0,
    departureDate,
    depositRequired: 0,
    groupName: `E2E Group Room Change ${unique}`,
    leadName: 'E2E Group Guest',
    leadPhone: '9999999999',
    notes: 'E2E group room reassignment',
    roomBlocks: [
      {
        adultsPerRoom: 2,
        childrenPerRoom: 0,
        roomTypeId,
        rooms: 1,
      },
    ],
    source: 'PHONE',
  });
}

async function assignRoom(page: Page, propertyId: string, groupHoldId: string, roomId: string) {
  return api<GroupHoldDto>(
    page,
    'POST',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/room-assignments`,
    { roomId },
  );
}

async function getHold(page: Page, propertyId: string, groupHoldId: string) {
  return api<GroupHoldDto>(
    page,
    'GET',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}`,
  );
}

async function cancelHoldBestEffort(
  page: Page,
  propertyId: string | undefined,
  groupHoldId: string | undefined,
) {
  if (!propertyId || !groupHoldId) return;

  try {
    await api<GroupHoldDto>(
      page,
      'POST',
      `/properties/${propertyId}/operations/group-holds/${groupHoldId}/cancel`,
      {},
    );
  } catch {
    // Cleanup should never hide the actual test result.
  }
}

test.describe('group room reassignment', () => {
  test('assigned group room can be changed before check-in and persists after reload', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    let propertyId: string | undefined;
    let groupHoldId: string | undefined;

    try {
      await loginAs(page, FRONT_DESK_EMAIL);

      const property = await activeProperty(page);
      propertyId = property.id;

      // Keep this far enough in the future so normal local test data is less
      // likely to conflict with the test.
      const arrivalDate = dateValue(35);
      const departureDate = dateValue(37);

      const available = await availableRooms(page, propertyId, arrivalDate, departureDate);

      const [oldRoom, replacementRoom] = pickSameTypeRoomPair(available);

      const created = await createOneRoomGroupHold(
        page,
        propertyId,
        arrivalDate,
        departureDate,
        oldRoom.roomType.id,
      );
      groupHoldId = created.id;

      const assigned = await assignRoom(page, propertyId, groupHoldId, oldRoom.roomId);

      expect(assigned.roomAssignments).toHaveLength(1);
      expect(assigned.roomAssignments[0].roomId).toBe(oldRoom.roomId);

      await page.goto(`/reservations/group-holds/${groupHoldId}`);
      await expect(page.getByText(created.groupCode)).toBeVisible({
        timeout: 20_000,
      });

      const assignedRoomCard = page
        .locator('div')
        .filter({
          has: page.getByText(`Room ${oldRoom.roomNumber}`, { exact: true }),
        })
        .filter({
          has: page.getByRole('button', { name: 'Change Room' }),
        })
        .last();

      await expect(assignedRoomCard).toBeVisible({ timeout: 15_000 });
      await assignedRoomCard.getByRole('button', { name: 'Change Room' }).click();

      const modal = page.getByRole('dialog', { name: 'Change Room' });
      await expect(modal).toBeVisible();

      const replacementInput = modal.getByLabel('Replacement room');
      await replacementInput.click();

      const replacementOption = page.getByRole('option').filter({
        hasText: new RegExp(`^${replacementRoom.roomNumber}\\s+-`),
      });

      await expect(replacementOption).toBeVisible({ timeout: 10_000 });
      await replacementOption.click();

      const changeResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes(`/operations/group-holds/${groupHoldId}/room-assignments/`),
      );

      await modal.getByRole('button', { name: 'Change Room' }).click();

      const response = await changeResponse;
      expect(response.ok()).toBeTruthy();

      await expect(modal).toBeHidden({ timeout: 15_000 });

      // API truth: the existing assignment must now point to the replacement.
      const afterChange = await getHold(page, propertyId, groupHoldId);

      expect(afterChange.roomAssignments).toHaveLength(1);
      expect(afterChange.roomAssignments[0].roomId).toBe(replacementRoom.roomId);
      expect(afterChange.roomAssignments[0].roomNumber).toBe(replacementRoom.roomNumber);
      expect(
        afterChange.roomAssignments.some((item) => item.roomId === oldRoom.roomId),
      ).toBeFalsy();

      // UI truth after reload: this proves the change was persisted, not only
      // changed in React state.
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      await expect(
        page.getByText(`Room ${replacementRoom.roomNumber}`, { exact: true }),
      ).toBeVisible({ timeout: 20_000 });

      await expect(page.getByText(`Room ${oldRoom.roomNumber}`, { exact: true })).toHaveCount(0);
    } finally {
      await cancelHoldBestEffort(page, propertyId, groupHoldId);
    }
  });
});
