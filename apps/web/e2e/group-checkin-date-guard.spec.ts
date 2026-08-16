import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty, resetE2EPropertyState } from './helpers/e2e-property';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const FRONT_DESK_EMAIL =
  process.env.E2E_FRONT_DESK_EMAIL ?? process.env.E2E_EMAIL ?? 'frontdesk@stayos.local';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type AvailableRoomDto = {
  roomId: string;
  roomNumber: string;
  operationalStatus: string;
  roomType: {
    id: string;
    code?: string;
    name?: string;
  };
};

type GroupHoldDto = {
  id: string;
  groupCode: string;
  groupName: string;
  arrivalDate: string;
  departureDate: string;
  status: 'ON_HOLD' | 'CONFIRMED' | 'RELEASED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
  roomAssignments: Array<{
    id: string;
    roomId: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
  }>;
};

type GroupCheckInPreviewDto = {
  blockers: string[];
  canCheckIn: boolean;
  warnings: string[];
  group: GroupHoldDto;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
    operationalStatus: string;
    ready: boolean;
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

async function rawApi(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<APIResponse> {
  const token = await accessToken(page);

  return page.request.fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  });
}

async function api<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await rawApi(page, method, path, body);
  const raw = await response.text();

  if (!response.ok()) {
    throw new Error(`${method} ${path} failed (${response.status()}): ${raw}`);
  }

  let parsed: ApiEnvelope<T> | T | undefined;

  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    throw new Error(`${method} ${path} returned non-JSON (${response.status()}): ${raw}`);
  }

  if (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed) {
    return (parsed as ApiEnvelope<T>).data;
  }

  return parsed as T;
}

function localDateValue(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function activeProperty(page: Page) {
  const fixture = await ensureE2EProperty(page);
  return { id: fixture.id };
}

async function findAvailableReadyRoom(
  page: Page,
  propertyId: string,
  arrivalDate: string,
  departureDate: string,
) {
  const query = new URLSearchParams({
    arrivalDate,
    departureDate,
  });

  const rooms = await api<AvailableRoomDto[]>(
    page,
    'GET',
    `/properties/${propertyId}/operations/available-rooms?${query.toString()}`,
  );

  const room = rooms.find(
    (item) =>
      Boolean(item.roomType?.id) && String(item.operationalStatus).toUpperCase() === 'READY',
  );

  if (!room) {
    throw new Error(
      `Could not find a READY room for ${arrivalDate} to ${departureDate}. Reset/seed local E2E inventory and rerun.`,
    );
  }

  return room;
}

async function createGroupHold(
  page: Page,
  propertyId: string,
  arrivalDate: string,
  departureDate: string,
  roomTypeId: string,
  suffix: string,
) {
  const unique = Date.now();

  return api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds`, {
    adults: 2,
    arrivalDate,
    children: 0,
    departureDate,
    depositRequired: 0,
    groupName: `E2E Check-in Guard ${suffix} ${unique}`,
    leadName: 'E2E Group Lead',
    leadPhone: '9999999999',
    notes: `E2E group check-in date guard ${suffix}`,
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

async function addRoomingListGuest(page: Page, propertyId: string, groupHoldId: string) {
  return api<GroupHoldDto>(
    page,
    'POST',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/rooming-list`,
    {
      adults: 2,
      children: 0,
      guestName: 'E2E Group Guest',
      phone: '9999999999',
    },
  );
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

async function confirmGroupHold(page: Page, propertyId: string, groupHoldId: string) {
  return api<GroupHoldDto>(
    page,
    'POST',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/confirm`,
    {},
  );
}

async function getGroupHold(page: Page, propertyId: string, groupHoldId: string) {
  return api<GroupHoldDto>(
    page,
    'GET',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}`,
  );
}

async function getCheckInPreview(page: Page, propertyId: string, groupHoldId: string) {
  return api<GroupCheckInPreviewDto>(
    page,
    'GET',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/check-in-preview`,
  );
}

async function createReadyConfirmedGroup(
  page: Page,
  propertyId: string,
  arrivalDate: string,
  departureDate: string,
  suffix: string,
) {
  const room = await findAvailableReadyRoom(page, propertyId, arrivalDate, departureDate);

  const hold = await createGroupHold(
    page,
    propertyId,
    arrivalDate,
    departureDate,
    room.roomType.id,
    suffix,
  );

  await addRoomingListGuest(page, propertyId, hold.id);
  await assignGroupRoom(page, propertyId, hold.id, room.roomId);

  const confirmed = await confirmGroupHold(page, propertyId, hold.id);

  return {
    confirmed,
    room,
  };
}

async function cancelGroupHoldBestEffort(
  page: Page,
  propertyId: string | undefined,
  groupHoldId: string | undefined,
) {
  if (!propertyId || !groupHoldId) return;

  try {
    const hold = await getGroupHold(page, propertyId, groupHoldId);

    if (hold.status === 'ON_HOLD' || hold.status === 'CONFIRMED') {
      await api<GroupHoldDto>(
        page,
        'POST',
        `/properties/${propertyId}/operations/group-holds/${groupHoldId}/cancel`,
        {},
      );
    }
  } catch {
    // Cleanup should never hide the real test failure.
  }
}

test.describe('group check-in date guard', () => {
  test.beforeEach(() => {
    resetE2EPropertyState();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, FRONT_DESK_EMAIL);
  });

  test('future confirmed group stays CONFIRMED and cannot be checked in early', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    let propertyId: string | undefined;
    let groupHoldId: string | undefined;

    try {
      const property = await activeProperty(page);
      propertyId = property.id;

      const arrivalDate = localDateValue(30);
      const departureDate = localDateValue(32);

      const { confirmed, room } = await createReadyConfirmedGroup(
        page,
        propertyId,
        arrivalDate,
        departureDate,
        'future',
      );

      groupHoldId = confirmed.id;

      expect(confirmed.status).toBe('CONFIRMED');

      const preview = await getCheckInPreview(page, propertyId, groupHoldId);

      expect(preview.canCheckIn).toBe(false);
      expect(
        preview.blockers.some((item) =>
          /check-in is not available yet|scheduled arrival date/i.test(item),
        ),
      ).toBe(true);

      const checkInResponse = await rawApi(
        page,
        'POST',
        `/properties/${propertyId}/operations/group-holds/${groupHoldId}/check-in`,
        {},
      );

      expect(checkInResponse.status()).toBe(400);

      const checkInError = await checkInResponse.text();
      expect(checkInError).toMatch(
        /check-in is not available yet|scheduled arrival date|cannot check in group/i,
      );

      const afterAttempt = await getGroupHold(page, propertyId, groupHoldId);

      // This is the core regression check for staff Issue #4:
      // confirmation must not silently turn into check-in.
      expect(afterAttempt.status).toBe('CONFIRMED');
      expect(afterAttempt.roomAssignments).toHaveLength(1);
      expect(afterAttempt.roomAssignments[0].roomId).toBe(room.roomId);
    } finally {
      await cancelGroupHoldBestEffort(page, propertyId, groupHoldId);
    }
  });

  test('today-arrival confirmed group is eligible for check-in without checking it in automatically', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    let propertyId: string | undefined;
    let groupHoldId: string | undefined;

    try {
      const property = await activeProperty(page);
      propertyId = property.id;

      const arrivalDate = localDateValue(0);
      const departureDate = localDateValue(1);

      const { confirmed } = await createReadyConfirmedGroup(
        page,
        propertyId,
        arrivalDate,
        departureDate,
        'today',
      );

      groupHoldId = confirmed.id;

      expect(confirmed.status).toBe('CONFIRMED');

      const preview = await getCheckInPreview(page, propertyId, groupHoldId);

      expect(preview.canCheckIn).toBe(true);
      expect(preview.blockers).toHaveLength(0);

      // Merely being eligible must still NOT auto-check the group in.
      const afterPreview = await getGroupHold(page, propertyId, groupHoldId);
      expect(afterPreview.status).toBe('CONFIRMED');
    } finally {
      await cancelGroupHoldBestEffort(page, propertyId, groupHoldId);
    }
  });

  test('future walk-in group request is rejected by backend', async ({ page }) => {
    test.setTimeout(60_000);

    const property = await activeProperty(page);

    const futureArrival = localDateValue(5);
    const futureDeparture = localDateValue(6);

    const room = await findAvailableReadyRoom(page, property.id, futureArrival, futureDeparture);

    const response = await rawApi(
      page,
      'POST',
      `/properties/${property.id}/operations/group-holds/walk-in`,
      {
        arrivalDate: futureArrival,
        departureDate: futureDeparture,
        groupName: `E2E Future Walk-in ${Date.now()}`,
        leadName: 'E2E Walk-in Lead',
        leadPhone: '9999999999',
        roomAssignments: [
          {
            roomId: room.roomId,
            adults: 2,
            children: 0,
          },
        ],
      },
    );

    expect(response.status()).toBe(400);

    const body = await response.text();

    expect(body).toMatch(/walk-in groups can only be checked in for today|use group quote/i);
  });
});
