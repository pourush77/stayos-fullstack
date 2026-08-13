import { expect, test, type APIResponse, type Page } from '@playwright/test';
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
  groupName: string;
  status: 'ON_HOLD' | 'CONFIRMED' | 'RELEASED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
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
  method: 'GET' | 'POST' | 'DELETE',
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
  method: 'GET' | 'POST',
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
  const properties = await api<PropertyDto[]>(page, 'GET', '/properties');

  const property =
    properties.find((item) => String(item.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ??
    properties[0];

  if (!property?.id) {
    throw new Error('No active property found for group-hold delete E2E.');
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
      `Could not find an available room for ${arrivalDate} to ${departureDate}. Reset/seed local E2E inventory and rerun.`,
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
    groupName: `E2E Delete Group ${suffix} ${unique}`,
    leadName: 'E2E Group Lead',
    leadPhone: '9999999999',
    notes: `E2E group delete ${suffix}`,
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

async function getGroupHold(page: Page, propertyId: string, groupHoldId: string) {
  return api<GroupHoldDto>(
    page,
    'GET',
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}`,
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
    // Cleanup should never hide the actual test result.
  }
}

test.describe('group hold delete', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, FRONT_DESK_EMAIL);
  });

  test('ON_HOLD group can be permanently deleted from Group Hold UI', async ({ page }) => {
    test.setTimeout(120_000);

    const property = await activeProperty(page);

    const arrivalDate = localDateValue(40);
    const departureDate = localDateValue(42);

    const room = await findAvailableRoom(page, property.id, arrivalDate, departureDate);

    const hold = await createGroupHold(
      page,
      property.id,
      arrivalDate,
      departureDate,
      room.roomType.id,
      'on-hold',
    );

    expect(hold.status).toBe('ON_HOLD');

    await page.goto(`/reservations/group-holds/${hold.id}`);
    await page.waitForLoadState('domcontentloaded');

    const deleteButton = page.getByRole('button', {
      name: 'Delete Group',
      exact: true,
    });

    await expect(deleteButton).toBeVisible({ timeout: 20_000 });
    await deleteButton.click();

    const modal = page.getByRole('dialog', { name: 'Delete Group' });

    await expect(modal).toBeVisible();
    await expect(modal.getByText(/This action cannot be undone/i)).toBeVisible();

    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().includes(`/operations/group-holds/${hold.id}`),
    );

    await modal.getByRole('button', { name: 'Delete Group', exact: true }).click();

    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/reservations(?:\?.*)?$/, {
      timeout: 20_000,
    });

    const readAfterDelete = await rawApi(
      page,
      'GET',
      `/properties/${property.id}/operations/group-holds/${hold.id}`,
    );

    expect(readAfterDelete.status()).toBe(404);

    await page.goto('/reservations');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId(`group-booking-row-${hold.id}`)).toHaveCount(0);
  });

  test('CONFIRMED group cannot be permanently deleted', async ({ page }) => {
    test.setTimeout(120_000);

    let propertyId: string | undefined;
    let groupHoldId: string | undefined;

    try {
      const property = await activeProperty(page);
      propertyId = property.id;

      const arrivalDate = localDateValue(50);
      const departureDate = localDateValue(52);

      const room = await findAvailableRoom(page, propertyId, arrivalDate, departureDate);

      const hold = await createGroupHold(
        page,
        propertyId,
        arrivalDate,
        departureDate,
        room.roomType.id,
        'confirmed',
      );

      groupHoldId = hold.id;

      const confirmed = await confirmGroupHold(page, propertyId, groupHoldId);

      expect(confirmed.status).toBe('CONFIRMED');

      await page.goto(`/reservations/group-holds/${groupHoldId}`);
      await page.waitForLoadState('domcontentloaded');

      await expect(
        page.getByRole('button', {
          name: 'Delete Group',
          exact: true,
        }),
      ).toHaveCount(0);

      const deleteResponse = await rawApi(
        page,
        'DELETE',
        `/properties/${propertyId}/operations/group-holds/${groupHoldId}`,
      );

      expect(deleteResponse.status()).toBe(400);

      const body = await deleteResponse.text();

      expect(body).toMatch(
        /only an unconfirmed group hold can be deleted|confirmed groups must be cancelled/i,
      );

      const afterDeleteAttempt = await getGroupHold(page, propertyId, groupHoldId);

      expect(afterDeleteAttempt.status).toBe('CONFIRMED');
    } finally {
      await cancelGroupHoldBestEffort(page, propertyId, groupHoldId);
    }
  });
});
