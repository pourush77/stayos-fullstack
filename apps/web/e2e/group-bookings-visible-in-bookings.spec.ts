import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const FRONT_DESK_EMAIL =
  process.env.E2E_FRONT_DESK_EMAIL ?? process.env.E2E_EMAIL ?? 'frontdesk@stayos.local';

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };
type PropertyDto = { id: string; status?: string };
type AvailableRoomDto = {
  roomId: string;
  roomNumber: string;
  roomType: { id: string; code?: string; name?: string };
};
type GroupHoldDto = {
  id: string;
  groupCode: string;
  groupName: string;
  status: 'ON_HOLD' | 'CONFIRMED' | 'RELEASED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
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
  method: 'GET' | 'POST',
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
    throw new Error('No active property found for group-bookings visibility E2E.');
  }

  return property;
}

async function findAvailableRoom(
  page: Page,
  propertyId: string,
  arrivalDate: string,
  departureDate: string,
) {
  const query = new URLSearchParams({ arrivalDate, departureDate });

  const rooms = await api<AvailableRoomDto[]>(
    page,
    'GET',
    `/properties/${propertyId}/operations/available-rooms?${query.toString()}`,
  );

  const room = rooms.find((item) => Boolean(item.roomType?.id));

  if (!room) {
    throw new Error(
      'Could not find an available room for the temporary group hold. Reset/seed local E2E inventory and rerun.',
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
) {
  const unique = Date.now();

  return api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds`, {
    adults: 2,
    arrivalDate,
    children: 0,
    departureDate,
    depositRequired: 0,
    groupName: `E2E Booking List Group ${unique}`,
    leadName: 'E2E Group Lead',
    leadPhone: '9999999999',
    notes: 'E2E verify group booking is visible in Bookings table',
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

async function cancelGroupHoldBestEffort(
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
    // Cleanup should never hide the real test result.
  }
}

test.describe('group bookings in bookings list', () => {
  test('group hold appears with normal bookings and opens group details', async ({ page }) => {
    test.setTimeout(120_000);

    let propertyId: string | undefined;
    let groupHoldId: string | undefined;

    try {
      await loginAs(page, FRONT_DESK_EMAIL);

      const property = await activeProperty(page);
      propertyId = property.id;

      const arrivalDate = dateValue(45);
      const departureDate = dateValue(47);

      const availableRoom = await findAvailableRoom(page, propertyId, arrivalDate, departureDate);

      const hold = await createGroupHold(
        page,
        propertyId,
        arrivalDate,
        departureDate,
        availableRoom.roomType.id,
      );

      groupHoldId = hold.id;

      await page.goto('/reservations');
      await page.waitForLoadState('domcontentloaded');

      const row = page.getByTestId(`group-booking-row-${hold.id}`);
      await expect(row).toBeVisible({ timeout: 20_000 });

      await expect(row.getByText('GROUP', { exact: true })).toBeVisible();
      await expect(row.getByText(hold.groupCode, { exact: true })).toBeVisible();
      await expect(row.getByText(hold.groupName, { exact: true })).toBeVisible();

      const openGroup = row.getByTestId(`group-booking-next-action-${hold.id}`);
      await expect(openGroup).toBeVisible();
      await openGroup.click();

      await expect(page).toHaveURL(new RegExp(`/reservations/group-holds/${hold.id}$`), {
        timeout: 20_000,
      });

      await expect(page.getByText(hold.groupCode, { exact: true })).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await cancelGroupHoldBestEffort(page, propertyId, groupHoldId);
    }
  });
});
