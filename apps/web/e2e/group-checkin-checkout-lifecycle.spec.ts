import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? process.env.E2E_EMAIL ?? 'manager@stayos.local';
const HOUSEKEEPING_EMAIL = process.env.E2E_HOUSEKEEPING_EMAIL ?? 'housekeeping@stayos.local';

const CHECKLIST = ['BED', 'BATHROOM', 'TOWELS', 'TOILETRIES', 'MIRROR', 'FLOOR', 'DUSTBIN'];

type ApiEnvelope<T> = { success?: boolean; data?: T; items?: T; results?: T };
type PropertyDto = { id: string; status?: string };
type FloorDto = { id: string };
type RoomTypeDto = { id: string; code: string; name: string };
type RoomDto = { id: string; roomNumber: string; roomTypeId?: string; roomType?: { id?: string; name?: string } };
type AvailableRoomDto = { roomId: string; roomNumber: string; roomType: { id: string; name?: string }; operationalStatus?: string };
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
  return String(value ?? '').toUpperCase().replace(/[\s-]/g, '_');
}

async function token(page: Page) {
  const value = await page.evaluate(
    () => window.localStorage.getItem('stayos.accessToken') ?? window.sessionStorage.getItem('stayos.accessToken'),
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

async function apiAttempt(page: Page, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) {
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token(page)}`, 'Content-Type': 'application/json' },
    data: body,
  });
  return { ok: response.ok(), status: response.status(), body: await response.text() };
}

async function activeProperty(page: Page) {
  const properties = await api<PropertyDto[]>(page, 'GET', '/properties');
  const property = properties.find((item) => String(item.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') ?? properties[0];
  if (!property?.id) throw new Error('No active property found.');
  return property.id;
}

async function createRoomType(page: Page, propertyId: string, code: string, name: string) {
  return api<RoomTypeDto>(page, 'POST', `/properties/${propertyId}/room-types`, {
    code,
    name,
    baseOccupancy: 2,
    maxOccupancy: 4,
    maxAdults: 3,
    maxChildren: 2,
    bedType: 'King',
    sizeSqFt: 360,
  });
}

async function createRoom(page: Page, propertyId: string, floorId: string, roomTypeId: string, roomNumber: string) {
  return api<RoomDto>(page, 'POST', `/properties/${propertyId}/rooms`, {
    floorId,
    roomTypeId,
    roomNumber,
    displayName: roomNumber,
    operationalStatus: 'READY',
  });
}

async function createGroup(page: Page, propertyId: string, deluxeTypeId: string, suiteTypeId: string, suffix: string) {
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
      { adultsPerRoom: 2, childrenPerRoom: 0, estimatedTotal: 5600, roomTypeId: deluxeTypeId, rooms: 2 },
      { adultsPerRoom: 2, childrenPerRoom: 0, estimatedTotal: 1400, roomTypeId: suiteTypeId, rooms: 1 },
    ],
    source: 'PHONE',
  });
}

async function assignGroupRoom(page: Page, propertyId: string, groupId: string, roomId: string) {
  return api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds/${groupId}/room-assignments`, { roomId });
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
  return api<AvailableRoomDto[]>(page, 'GET', `/properties/${propertyId}/operations/available-rooms?${query.toString()}`);
}

async function masterFolio(page: Page, propertyId: string, groupId: string) {
  return api<GroupMasterFolioDto>(page, 'GET', `/properties/${propertyId}/operations/group-bookings/${groupId}/master-folio`);
}

async function recordGroupPayment(page: Page, amount: number, reference: string) {
  await page.getByRole('textbox', { name: 'Amount' }).nth(1).fill(String(amount));
  await page.getByRole('textbox', { name: 'Reference' }).fill(reference);
  await page.getByRole('button', { name: 'Record payment' }).click();
}

async function getHousekeepingEmployeeId(page: Page, propertyId: string) {
  const employees = await api<Array<{ id: string }>>(page, 'GET', `/properties/${propertyId}/employees?department=HOUSEKEEPING&status=ACTIVE`);
  const employee = employees[0];
  if (!employee?.id) throw new Error('No active housekeeping employee found.');
  return employee.id;
}

async function cleanRoomToReady(page: Page, propertyId: string, roomId: string) {
  await loginAs(page, HOUSEKEEPING_EMAIL);
  const employeeId = await getHousekeepingEmployeeId(page, propertyId);
  await api(page, 'PATCH', `/properties/${propertyId}/housekeeping/rooms/${roomId}/assign`, { employeeId });
  await api(page, 'PATCH', `/properties/${propertyId}/housekeeping/rooms/${roomId}/start`, { employeeId });
  await api(page, 'PATCH', `/properties/${propertyId}/housekeeping/rooms/${roomId}/complete`, {
    employeeId,
    completedOnBehalf: true,
    checklist: CHECKLIST.map((key) => ({ key, completed: true })),
  });
  await expect.poll(async () => status((await boardItem(page, propertyId, roomId)).operationalStatus), { timeout: 20_000 }).toBe('INSPECTION');
  await api(page, 'PATCH', `/properties/${propertyId}/housekeeping/rooms/${roomId}/inspect`, { action: 'APPROVE' });
  await expect.poll(async () => status((await boardItem(page, propertyId, roomId)).operationalStatus), { timeout: 20_000 }).toBe('READY');
  await loginAs(page, MANAGER_EMAIL);
}

test.describe('fresh group check-in checkout lifecycle', () => {
  test('clean group moves through check-in, checkout, housekeeping, and availability', async ({ page }) => {
    test.setTimeout(360_000);
    await loginAs(page, MANAGER_EMAIL);

    const propertyId = await activeProperty(page);
    const floors = await api<FloorDto[]>(page, 'GET', `/properties/${propertyId}/floors`);
    const floorId = floors[0]?.id;
    if (!floorId) throw new Error('No floor available for deterministic group lifecycle rooms.');

    const suffix = String(Date.now()).slice(-8);
    const deluxe = await createRoomType(page, propertyId, `GDL${suffix.slice(-5)}`, `E2E Deluxe ${suffix}`);
    const suite = await createRoomType(page, propertyId, `GST${suffix.slice(-5)}`, `E2E Suite ${suffix}`);
    const deluxeA = await createRoom(page, propertyId, floorId, deluxe.id, `GL${suffix}A`);
    const deluxeB = await createRoom(page, propertyId, floorId, deluxe.id, `GL${suffix}B`);
    const deluxeMove = await createRoom(page, propertyId, floorId, deluxe.id, `GL${suffix}M`);
    const suiteA = await createRoom(page, propertyId, floorId, suite.id, `GL${suffix}S`);

    const created = await createGroup(page, propertyId, deluxe.id, suite.id, suffix);
    let hold = await api<GroupHoldDto>(page, 'POST', `/properties/${propertyId}/operations/group-holds/${created.id}/confirm`, {});
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

    await page.goto(`/reservations/group-holds/${hold.id}`);
    await expect(page.getByText(hold.groupCode)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Prepare Check-in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Complete Checkout|Checked Out/ })).toBeDisabled();
    for (const assignment of hold.roomAssignments) {
      const room = await boardItem(page, propertyId, assignment.roomId);
      expect(status(room.operationalStatus)).toBe('READY');
      expect(status(room.uiStatus)).not.toBe('OCCUPIED');
    }

    const checkIn = await api<{ group: GroupHoldDto }>(page, 'POST', `/properties/${propertyId}/operations/group-holds/${hold.id}/check-in`, {});
    hold = checkIn.group;
    expect(hold.status).toBe('CHECKED_IN');
    for (const assignment of hold.roomAssignments) {
      const room = await boardItem(page, propertyId, assignment.roomId);
      expect(status(room.operationalStatus)).toBe('OCCUPIED');
      expect(status(room.uiStatus)).toBe('OCCUPIED');
      expect(room.groupContext?.groupCode).toBe(hold.groupCode);
    }

    await page.goto(`/reservations/group-holds/${hold.id}`);
    await expect(page.getByRole('button', { name: 'Change Room' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Complete Checkout' })).toBeDisabled();

    const moveAssignment = hold.roomAssignments.find((assignment) => assignment.roomTypeId === deluxe.id);
    if (moveAssignment) {
      const candidatesAttempt = await apiAttempt(
        page,
        'GET',
        `/properties/${propertyId}/operations/group-holds/${hold.id}/room-assignments/${moveAssignment.id}/change-candidates`,
      );
      if (candidatesAttempt.ok) {
        const candidates = (JSON.parse(candidatesAttempt.body) as ApiEnvelope<AvailableRoomDto[]>).data ?? [];
        if (candidates.some((candidate) => candidate.roomId === deluxeMove.id)) {
          const moved = await api<GroupHoldDto>(
            page,
            'PATCH',
            `/properties/${propertyId}/operations/group-holds/${hold.id}/room-assignments/${moveAssignment.id}`,
            { roomId: deluxeMove.id },
          );
          hold = moved;
          expect(hold.roomAssignments).toHaveLength(3);
          expect(hold.roomAssignments.filter((assignment) => assignment.roomId === deluxeMove.id)).toHaveLength(1);
          expect(hold.roomAssignments.some((assignment) => assignment.roomId === moveAssignment.roomId)).toBeFalsy();
          expect(status((await boardItem(page, propertyId, deluxeMove.id)).operationalStatus)).toBe('OCCUPIED');
          expect(status((await boardItem(page, propertyId, moveAssignment.roomId)).operationalStatus)).toBe('READY');
        }
      }
    }

    await page.goto(`/reservations/group-holds/${hold.id}/master-folio`);
    await expect(page.getByText(hold.groupCode)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-total-charges')).toContainText('7,000');
    await expect(page.getByTestId('group-total-paid')).toContainText('0');
    await expect(page.getByTestId('group-balance-due')).toContainText('7,000');
    await expect(page.getByTestId('group-payment-status')).toContainText('UNPAID');
    await expect(page.getByRole('button', { name: 'Complete checkout' })).toBeDisabled();

    await recordGroupPayment(page, 5600, `UAT-${hold.groupCode}-PARTIAL`);
    await expect.poll(async () => (await masterFolio(page, propertyId, hold.id)).checkoutSummary.totalPaid, { timeout: 20_000 }).toBe(5600);
    await page.reload();
    await expect(page.getByTestId('group-total-paid')).toContainText('5,600');
    await expect(page.getByTestId('group-balance-due')).toContainText('1,400');
    await expect(page.getByTestId('group-payment-status')).toContainText('PARTIALLY PAID');
    await expect(page.getByTestId('group-payment-history')).toContainText(`UAT-${hold.groupCode}-PARTIAL`);

    await recordGroupPayment(page, 1400, `UAT-${hold.groupCode}-FINAL`);
    await expect.poll(async () => (await masterFolio(page, propertyId, hold.id)).checkoutSummary.balanceDue, { timeout: 20_000 }).toBe(0);
    await page.reload();
    await expect(page.getByTestId('group-total-paid')).toContainText('7,000');
    await expect(page.getByTestId('group-balance-due')).toContainText('0');
    await expect(page.getByTestId('group-payment-status')).toContainText('PAID');
    await expect(page.getByTestId('group-payment-history')).toContainText(`UAT-${hold.groupCode}-PARTIAL`);
    await expect(page.getByTestId('group-payment-history')).toContainText(`UAT-${hold.groupCode}-FINAL`);
    const settledFolio = await masterFolio(page, propertyId, hold.id);
    expect(settledFolio.payments).toHaveLength(2);
    expect(settledFolio.checkoutSummary).toMatchObject({
      balanceDue: 0,
      paymentStatus: 'PAID',
      totalCharges: 7000,
      totalPaid: 7000,
    });
    await expect(page.getByRole('button', { name: 'Complete checkout' })).toBeEnabled();
    await page.getByRole('button', { name: 'Complete checkout' }).click();
    await expect.poll(async () => (await api<GroupHoldDto>(page, 'GET', `/properties/${propertyId}/operations/group-holds/${hold.id}`)).status, { timeout: 20_000 }).toBe('CHECKED_OUT');
    hold = await api<GroupHoldDto>(page, 'GET', `/properties/${propertyId}/operations/group-holds/${hold.id}`);
    expect(hold.status).toBe('CHECKED_OUT');

    for (const assignment of hold.roomAssignments) {
      const room = await boardItem(page, propertyId, assignment.roomId);
      expect(room.groupContext ?? null).toBeNull();
      expect(status(room.operationalStatus)).toBe('NEEDS_CLEANING');
      expect((await availableRooms(page, propertyId)).some((candidate) => candidate.roomId === assignment.roomId)).toBeFalsy();
    }

    for (const assignment of hold.roomAssignments) {
      await cleanRoomToReady(page, propertyId, assignment.roomId);
    }

    const finalHold = await api<GroupHoldDto>(page, 'GET', `/properties/${propertyId}/operations/group-holds/${hold.id}`);
    expect(finalHold.status).toBe('CHECKED_OUT');
    const finalAvailability = await availableRooms(page, propertyId);
    for (const assignment of finalHold.roomAssignments) {
      const room = await boardItem(page, propertyId, assignment.roomId);
      expect(status(room.operationalStatus)).toBe('READY');
      expect(room.groupContext ?? null).toBeNull();
      expect(finalAvailability.some((candidate) => candidate.roomId === assignment.roomId)).toBeTruthy();
    }
  });
});
