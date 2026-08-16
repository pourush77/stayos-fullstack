import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty, resetE2EPropertyState } from './helpers/e2e-property';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const MANAGER_EMAIL =
  process.env.E2E_MANAGER_EMAIL ?? process.env.E2E_EMAIL ?? 'manager@stayos.local';
const HOUSEKEEPING_EMAIL = process.env.E2E_HOUSEKEEPING_EMAIL ?? 'housekeeping@stayos.local';

const CHECKLIST = ['BED', 'BATHROOM', 'TOWELS', 'TOILETRIES', 'MIRROR', 'FLOOR', 'DUSTBIN'];

type ApiEnvelope<T> = { success?: boolean; data?: T; items?: T; results?: T };
type RoomDto = {
  floorId?: string;
  id: string;
  roomNumber: string;
  roomTypeId?: string;
  roomType?: { id?: string; name?: string };
};
type AvailableRoomDto = {
  roomId: string;
  roomNumber: string;
  roomType: { id: string; name?: string };
  operationalStatus?: string;
};
type GroupHoldDto = {
  id: string;
  groupCode: string;
  status: string;
  roomAssignments: Array<{ id: string; roomId: string; roomNumber: string; roomTypeId: string }>;
};
type GroupMasterFolioDto = {
  checkoutSummary: {
    balanceDue: number;
    paymentStatus: string;
    totalCharges: number;
    totalPaid: number;
  };
  payments: Array<{ amount: number; method: string; reference?: string | null }>;
};
type RoomBoardItem = {
  roomId: string;
  roomNumber: string;
  uiStatus: string;
  operationalStatus: string;
  currentStay?: unknown | null;
  groupContext?: { groupCode?: string; groupName?: string; status?: string } | null;
};

function dateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function status(value: string | undefined) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '_');
}

async function token(page: Page) {
  const value = await page.evaluate(
    () =>
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken'),
  );
  if (!value) throw new Error('No StayOS access token found.');
  return value;
}

async function api<T>(page: Page, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) {
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token(page)}`, 'Content-Type': 'application/json' },
    data: body,
  });
  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as ApiEnvelope<T> | T) : undefined;
  if (!response.ok()) throw new Error(`${method} ${path} failed (${response.status()}): ${raw}`);
  if (parsed && typeof parsed === 'object') {
    if ('data' in parsed && parsed.data !== undefined) return parsed.data as T;
    if ('items' in parsed && parsed.items !== undefined) return parsed.items as T;
    if ('results' in parsed && parsed.results !== undefined) return parsed.results as T;
  }
  return parsed as T;
}

async function apiAttempt(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
) {
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token(page)}`, 'Content-Type': 'application/json' },
    data: body,
  });
  return { ok: response.ok(), status: response.status(), body: await response.text() };
}

async function createGroup(
  page: Page,
  propertyId: string,
  deluxeTypeId: string,
  suiteTypeId: string,
  suffix: string,
) {
  return api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds`, {
    adults: 6,
    arrivalDate: dateKey(0),
    children: 0,
    departureDate: dateKey(1),
    depositRequired: 1400,
    estimatedTotal: 7000,
    groupName: `E2E Lifecycle Group ${suffix}`,
    leadName: 'E2E Group Lead',
    leadPhone: `9${suffix.slice(-9).padStart(9, '0')}`,
    notes: 'E2E group check-in checkout lifecycle',
    roomBlocks: [
      {
        adultsPerRoom: 2,
        childrenPerRoom: 0,
        estimatedTotal: 5600,
        roomTypeId: deluxeTypeId,
        rooms: 2,
      },
      {
        adultsPerRoom: 2,
        childrenPerRoom: 0,
        estimatedTotal: 1400,
        roomTypeId: suiteTypeId,
        rooms: 1,
      },
    ],
    source: 'PHONE',
  });
}

async function assignGroupRoom(page: Page, propertyId: string, groupId: string, roomId: string) {
  return api<GroupHoldDto>(
    page,
    'POST',
    `/properties/${propertyId}/operations/group-holds/${groupId}/room-assignments`,
    { roomId },
  );
}

async function roomBoard(page: Page, propertyId: string) {
  return api<RoomBoardItem[]>(page, 'GET', `/properties/${propertyId}/operations/room-board`);
}

async function boardItem(page: Page, propertyId: string, roomId: string) {
  const item = (await roomBoard(page, propertyId)).find((room) => room.roomId === roomId);
  if (!item) throw new Error(`Room ${roomId} not found on room board.`);
  return item;
}

async function availableRooms(page: Page, propertyId: string, roomTypeId?: string) {
  const query = new URLSearchParams({ arrivalDate: dateKey(0), departureDate: dateKey(1) });
  if (roomTypeId) query.set('roomTypeId', roomTypeId);
  return api<AvailableRoomDto[]>(
    page,
    'GET',
    `/properties/${propertyId}/operations/available-rooms?${query.toString()}`,
  );
}

async function masterFolio(page: Page, propertyId: string, groupId: string) {
  return api<GroupMasterFolioDto>(
    page,
    'GET',
    `/properties/${propertyId}/operations/group-bookings/${groupId}/master-folio`,
  );
}

async function recordGroupPayment(page: Page, amount: number, reference: string) {
  await page.getByRole('textbox', { name: 'Amount' }).nth(1).fill(String(amount));
  await page.getByRole('textbox', { name: 'Reference' }).fill(reference);
  await page.getByRole('button', { name: 'Record payment' }).click();
}

async function getHousekeepingEmployeeId(page: Page, propertyId: string) {
  const employees = await api<Array<{ id: string }>>(
    page,
    'GET',
    `/properties/${propertyId}/employees?department=HOUSEKEEPING&status=ACTIVE`,
  );
  const employee = employees[0];
  if (!employee?.id) throw new Error('No active housekeeping employee found.');
  return employee.id;
}

async function cleanRoomToReady(page: Page, propertyId: string, roomId: string) {
  await api(page, 'PATCH', `/properties/${propertyId}/rooms/${roomId}/mark-ready`, {
    reason: 'E2E lifecycle cleanup',
    note: 'Reset checked-out E2E room to ready',
  });
  await expect
    .poll(async () => status((await boardItem(page, propertyId, roomId)).operationalStatus), {
      timeout: 20_000,
    })
    .toBe('READY');
}

test.describe('fresh group check-in checkout lifecycle', () => {
  test('clean group moves through check-in, checkout, housekeeping, and availability', async ({
    page,
  }) => {
    test.setTimeout(360_000);
    resetE2EPropertyState();
    await loginAs(page, MANAGER_EMAIL);

    const fixture = await ensureE2EProperty(page);
    const propertyId = fixture.id;
    const deluxe = fixture.roomTypes.E2E_DLX;
    const suite = fixture.roomTypes.E2E_STE;
    const deluxeA = fixture.rooms.E201;
    const deluxeB = fixture.rooms.E202;
    const deluxeMove = fixture.rooms.E203;
    const suiteA = fixture.rooms.E205;
    const suffix = 'FIXED';

    try {
      const created = await createGroup(page, propertyId, deluxe.id, suite.id, suffix);
      let hold = await api<GroupHoldDto>(
        page,
        'POST',
        `/properties/${propertyId}/operations/group-holds/${created.id}/confirm`,
        {},
      );
      expect(hold.status).toBe('CONFIRMED');

      hold = await assignGroupRoom(page, propertyId, hold.id, deluxeA.id);
      hold = await assignGroupRoom(page, propertyId, hold.id, deluxeB.id);
      hold = await assignGroupRoom(page, propertyId, hold.id, suiteA.id);
      expect(hold.roomAssignments).toHaveLength(3);
      for (const index of [1, 2, 3]) {
        hold = await api<GroupHoldDto>(
          page,
          'POST',
          `/properties/${propertyId}/operations/group-holds/${hold.id}/rooming-list`,
          {
            adults: 2,
            children: 0,
            guestName: `E2E Group Guest ${suffix}-${index}`,
            phone: `98${suffix.slice(-8)}`,
            notes: 'E2E group lifecycle rooming list',
          },
        );
      }

      for (const assignment of hold.roomAssignments) {
        const room = await boardItem(page, propertyId, assignment.roomId);
        expect(status(room.operationalStatus)).toBe('READY');
        expect(status(room.uiStatus)).not.toBe('OCCUPIED');
      }

      await api(
        page,
        'POST',
        `/properties/${propertyId}/operations/group-holds/${hold.id}/check-in`,
        {},
      );
      hold = await api<GroupHoldDto>(
        page,
        'GET',
        `/properties/${propertyId}/operations/group-holds/${hold.id}`,
      );
      expect(hold.status).toBe('CHECKED_IN');
      for (const assignment of hold.roomAssignments) {
        const room = await boardItem(page, propertyId, assignment.roomId);
        expect(status(room.operationalStatus)).toBe('OCCUPIED');
        expect(status(room.uiStatus)).toBe('OCCUPIED');
        expect(room.groupContext?.groupCode).toBe(hold.groupCode);
      }

      await api(page, 'POST', `/properties/${propertyId}/operations/group-bookings/${hold.id}/master-folio/payments`, {
        amount: 5600,
        method: 'CASH',
        reference: `UAT-${hold.groupCode}-PARTIAL`,
      });
      await expect
        .poll(
          async () => (await masterFolio(page, propertyId, hold.id)).checkoutSummary.totalPaid,
          { timeout: 20_000 },
        )
        .toBe(5600);

      await api(page, 'POST', `/properties/${propertyId}/operations/group-bookings/${hold.id}/master-folio/payments`, {
        amount: 1400,
        method: 'CASH',
        reference: `UAT-${hold.groupCode}-FINAL`,
      });
      await expect
        .poll(
          async () => (await masterFolio(page, propertyId, hold.id)).checkoutSummary.balanceDue,
          { timeout: 20_000 },
        )
        .toBe(0);
      const settledFolio = await masterFolio(page, propertyId, hold.id);
      expect(settledFolio.payments).toHaveLength(2);
      expect(settledFolio.checkoutSummary).toMatchObject({
        balanceDue: 0,
        paymentStatus: 'PAID',
        totalCharges: 7000,
        totalPaid: 7000,
      });
      await api(
        page,
        'POST',
        `/properties/${propertyId}/operations/group-bookings/${hold.id}/master-folio/checkout`,
        {},
      );
      await expect
        .poll(
          async () =>
            (
              await api<GroupHoldDto>(
                page,
                'GET',
                `/properties/${propertyId}/operations/group-holds/${hold.id}`,
              )
            ).status,
          { timeout: 20_000 },
        )
        .toBe('CHECKED_OUT');
      hold = await api<GroupHoldDto>(
        page,
        'GET',
        `/properties/${propertyId}/operations/group-holds/${hold.id}`,
      );
      expect(hold.status).toBe('CHECKED_OUT');

      for (const assignment of hold.roomAssignments) {
        const room = await boardItem(page, propertyId, assignment.roomId);
        expect(room.groupContext ?? null).toBeNull();
        expect(status(room.operationalStatus)).toBe('NEEDS_CLEANING');
        expect(
          (await availableRooms(page, propertyId)).some(
            (candidate) => candidate.roomId === assignment.roomId,
          ),
        ).toBeFalsy();
      }

      for (const assignment of hold.roomAssignments) {
        await cleanRoomToReady(page, propertyId, assignment.roomId);
      }

      const finalHold = await api<GroupHoldDto>(
        page,
        'GET',
        `/properties/${propertyId}/operations/group-holds/${hold.id}`,
      );
      expect(finalHold.status).toBe('CHECKED_OUT');
      const finalAvailability = await availableRooms(page, propertyId);
      for (const assignment of finalHold.roomAssignments) {
        const room = await boardItem(page, propertyId, assignment.roomId);
        expect(status(room.operationalStatus)).toBe('READY');
        expect(room.groupContext ?? null).toBeNull();
        expect(
          finalAvailability.some((candidate) => candidate.roomId === assignment.roomId),
        ).toBeTruthy();
      }
    } finally {
      resetE2EPropertyState();
    }
  });
});
