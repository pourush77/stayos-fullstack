import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty, resetE2EPropertyState } from './helpers/e2e-property';

const frontDeskEmail = 'frontdesk@stayos.local';
const maintenanceEmail = 'maintenance@stayos.local';
const housekeepingEmail = 'housekeeping@stayos.local';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type LooseRecord = Record<string, unknown>;

type ReadyRoom = {
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
};

type ScenarioRooms = {
  propertyId: string;
  arrivalDate: string;
  departureDate: string;
  roomA: ReadyRoom;
};

type CreatedGuest = {
  guestId: string;
  guestName: string;
};

type CreatedReservation = {
  reservationId: string;
  reservationCode: string;
};

type RoomBoardItem = {
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  uiStatus: string;
  operationalStatus: string;
  currentStayReservationId?: string;
  currentStayReservationCode?: string;
  currentStayGuestName?: string;
  currentStayStatus?: string;
  groupContext?: LooseRecord | null;
};

type ApiRequestInput = {
  method?: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
};

type ApiResult<T> = {
  ok: boolean;
  status: number;
  body: T;
};

const HOUSEKEEPING_CHECKLIST_KEYS = [
  'BED',
  'BATHROOM',
  'TOWELS',
  'TOILETRIES',
  'MIRROR',
  'FLOOR',
  'DUSTBIN',
] as const;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return toDateKey(next);
}

function normalizeStatus(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, '_');
}

async function apiRequest<T>(page: Page, input: ApiRequestInput): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ baseUrl, request }) => {
      type ApiEnvelope<TValue> =
        TValue | { data?: TValue } | { items?: TValue } | { results?: TValue };

      const unwrap = <TValue>(payload: ApiEnvelope<TValue>): TValue => {
        if (payload && typeof payload === 'object') {
          if ('data' in payload && payload.data !== undefined) return payload.data;
          if ('items' in payload && payload.items !== undefined) return payload.items;
          if ('results' in payload && payload.results !== undefined) return payload.results;
        }
        return payload as TValue;
      };

      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');

      if (!token) {
        throw new Error('No auth token available for maintenance lifecycle API call.');
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
        body: response.ok ? unwrap<T>(rawBody as ApiEnvelope<T>) : (rawBody as T),
      };
    },
    {
      baseUrl: apiBaseUrl,
      request: input,
    },
  );
}

async function getActivePropertyId(page: Page) {
  return (await ensureE2EProperty(page)).id;
}

async function discoverReadyRoomForToday(page: Page): Promise<ScenarioRooms> {
  const propertyId = await getActivePropertyId(page);
  const arrivalDate = toDateKey(new Date());
  const departureDate = addDays(arrivalDate, 1);
  const rooms = await discoverReadyRoomsForDates(page, {
    propertyId,
    arrivalDate,
    departureDate,
  });

  if (rooms[0]) {
    return {
      propertyId,
      arrivalDate,
      departureDate,
      roomA: rooms[0],
    };
  }

  throw new Error(
    'Could not find a vacant READY room for today. Reset/seed local E2E inventory and rerun.',
  );
}

async function discoverReadyRoomPairForToday(page: Page): Promise<ScenarioRooms & { roomB: ReadyRoom }> {
  const pool = await ensureReadyRoomPoolForToday(page, 2);
  const { propertyId, arrivalDate, departureDate, rooms } = pool;
  const sameTypePair = rooms
    .map((roomA) => ({
      roomA,
      roomB: rooms.find(
        (roomB) => roomB.roomId !== roomA.roomId && roomB.roomTypeId === roomA.roomTypeId,
      ),
    }))
    .find((pair): pair is { roomA: ReadyRoom; roomB: ReadyRoom } => Boolean(pair.roomB));

  const pair =
    sameTypePair ??
    (rooms[0] && rooms[1] ? { roomA: rooms[0], roomB: rooms[1] } : undefined);

  if (!pair) {
    throw new Error(
      'Could not find two vacant non-group READY rooms for maintenance relocation. Reset/seed local E2E inventory and rerun.',
    );
  }

  return {
    propertyId,
    arrivalDate,
    departureDate,
    roomA: pair.roomA,
    roomB: pair.roomB,
  };
}

async function discoverReadyRoomsForDates(
  page: Page,
  input: {
    propertyId: string;
    arrivalDate: string;
    departureDate: string;
  },
): Promise<ReadyRoom[]> {
  const response = await apiRequest<LooseRecord[]>(page, {
    path:
      `/properties/${input.propertyId}/operations/available-rooms` +
      `?arrivalDate=${input.arrivalDate}` +
      `&departureDate=${input.departureDate}` +
      `&guestCount=1&adults=1&children=0`,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to discover READY rooms: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  const roomBoard = await getRoomBoard(page, input.propertyId);
  const boardByRoomId = new Map(roomBoard.map((room) => [room.roomId, room]));

  return response.body
    .map((room) => {
      const roomType = (room.roomType ?? {}) as LooseRecord;
      return {
        roomId: String(room.roomId ?? room.id ?? ''),
        roomNumber: String(room.roomNumber ?? ''),
        roomTypeId: String(roomType.id ?? ''),
        roomTypeName: String(roomType.name ?? roomType.code ?? 'Room'),
      };
    })
    .filter((room) => room.roomId && room.roomNumber && room.roomTypeId)
    .filter((room) => {
      const boardRoom = boardByRoomId.get(room.roomId);
      return (
        boardRoom &&
        normalizeStatus(boardRoom.uiStatus || boardRoom.operationalStatus) === 'READY' &&
        !boardRoom.currentStayReservationId &&
        !boardRoom.groupContext
      );
    });
}

async function ensureReadyRoomPoolForToday(
  page: Page,
  requiredCount: number,
): Promise<ScenarioRooms & { rooms: ReadyRoom[] }> {
  const propertyId = await getActivePropertyId(page);
  const arrivalDate = toDateKey(new Date());
  const departureDate = addDays(arrivalDate, 1);

  let rooms = await discoverReadyRoomsForDates(page, {
    propertyId,
    arrivalDate,
    departureDate,
  });

  if (rooms.length < requiredCount) {
    await restoreIdleHousekeepingRoomsToReady(page, {
      propertyId,
      needed: requiredCount - rooms.length,
    });

    rooms = await discoverReadyRoomsForDates(page, {
      propertyId,
      arrivalDate,
      departureDate,
    });
  }

  if (rooms.length < requiredCount) {
    throw new Error(
      `Could not construct ${requiredCount} vacant non-group READY rooms for maintenance lifecycle E2E. Found ${rooms.length}.`,
    );
  }

  return {
    propertyId,
    arrivalDate,
    departureDate,
    roomA: rooms[0],
    rooms,
  };
}

async function restoreIdleHousekeepingRoomsToReady(
  page: Page,
  input: {
    propertyId: string;
    needed: number;
  },
) {
  if (input.needed <= 0) return;

  await loginAs(page, housekeepingEmail);

  const employeeId = await getHousekeepingEmployeeId(page, input.propertyId);
  const board = await getRoomBoard(page, input.propertyId);
  const candidates = board
    .filter((room) => !room.currentStayReservationId && !room.groupContext)
    .filter((room) =>
      ['NEEDS_CLEANING', 'INSPECTION', 'CLEANING'].includes(
        normalizeStatus(room.operationalStatus || room.uiStatus),
      ),
    )
    .slice(0, input.needed);

  for (const room of candidates) {
    const status = normalizeStatus(room.operationalStatus || room.uiStatus);
    if (status === 'NEEDS_CLEANING' || status === 'CLEANING') {
      const assignResponse = await apiRequest<LooseRecord>(page, {
        method: 'PATCH',
        path: `/properties/${input.propertyId}/housekeeping/rooms/${room.roomId}/assign`,
        body: { employeeId },
      });

      if (!assignResponse.ok) continue;

      const startResponse = await apiRequest<LooseRecord>(page, {
        method: 'PATCH',
        path: `/properties/${input.propertyId}/housekeeping/rooms/${room.roomId}/start`,
        body: { employeeId },
      });

      if (!startResponse.ok) continue;

      const completeResponse = await apiRequest<LooseRecord>(page, {
        method: 'PATCH',
        path: `/properties/${input.propertyId}/housekeeping/rooms/${room.roomId}/complete`,
        body: {
          employeeId,
          completedOnBehalf: true,
          checklist: HOUSEKEEPING_CHECKLIST_KEYS.map((key) => ({ key, completed: true })),
        },
      });

      if (!completeResponse.ok) continue;
    }

    await apiRequest<LooseRecord>(page, {
      method: 'PATCH',
      path: `/properties/${input.propertyId}/housekeeping/rooms/${room.roomId}/inspect`,
      body: { action: 'APPROVE' },
    }).catch(() => undefined);
  }

  await loginAs(page, frontDeskEmail);
}

async function createUniqueGuest(page: Page, propertyId: string): Promise<CreatedGuest> {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const firstName = 'E2E';
  const lastName = `Maint${unique.slice(-6)}`;
  const guestName = `${firstName} ${lastName}`;
  const phone = `9${unique.slice(-9)}`.slice(0, 10);
  const email = `e2e.maint.${unique}@example.com`;

  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${propertyId}/guests`,
    body: {
      firstName,
      lastName,
      phone,
      email,
      nationality: 'Indian',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to create guest: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  const guestId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');

  if (!guestId) {
    throw new Error('Guest created but no guest id was returned.');
  }

  return {
    guestId,
    guestName,
  };
}

async function createConfirmedReservation(
  page: Page,
  input: {
    propertyId: string;
    guestId: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
  },
): Promise<CreatedReservation> {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${input.propertyId}/reservations`,
    body: {
      guestId: input.guestId,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      adults: 1,
      children: 0,
      roomTypeId: input.roomTypeId,
      source: 'DIRECT',
      status: 'CONFIRMED',
      paymentStatus: 'PAYMENT_DUE',
      notes: 'E2E maintenance room lifecycle',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to create reservation: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }

  const reservationId = String(response.body.id ?? response.body._id ?? response.body.uuid ?? '');
  const reservationCode = String(
    response.body.reservationCode ?? response.body.code ?? response.body.confirmationNumber ?? '',
  );

  if (!reservationId) {
    throw new Error('Reservation created but no reservation id was returned.');
  }

  return {
    reservationId,
    reservationCode,
  };
}

async function assignReservationRoom(
  page: Page,
  propertyId: string,
  reservationId: string,
  roomId: string,
) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/assign-room`,
    body: {
      roomId,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to assign room: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }
}

async function readReservation(page: Page, propertyId: string, reservationId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    path: `/properties/${propertyId}/reservations/${reservationId}`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read reservation ${reservationId}: HTTP ${response.status}`);
  }

  return response.body;
}

async function getRoomBoardItem(
  page: Page,
  propertyId: string,
  roomId: string,
): Promise<RoomBoardItem> {
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/operations/room-board`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read room board: HTTP ${response.status}`);
  }

  const room = response.body.find((item) => String(item.roomId ?? item.id ?? '') === roomId);

  if (!room) {
    throw new Error(`Room ${roomId} not found in room board.`);
  }

  const roomType = (room.roomType ?? {}) as LooseRecord;
  const currentStay = (room.currentStay ?? {}) as LooseRecord;
  const groupContext = (room.groupContext ?? null) as LooseRecord | null;

  return {
    roomId: String(room.roomId ?? room.id ?? ''),
    roomNumber: String(room.roomNumber ?? ''),
    roomTypeId: String(roomType.id ?? ''),
    roomTypeName: String(roomType.name ?? roomType.code ?? 'Room'),
    uiStatus: String(room.uiStatus ?? ''),
    operationalStatus: String(room.operationalStatus ?? ''),
    currentStayReservationId: String(currentStay.reservationId ?? ''),
    currentStayReservationCode: String(currentStay.reservationCode ?? ''),
    currentStayGuestName: String(currentStay.guestName ?? ''),
    currentStayStatus: String(currentStay.status ?? ''),
    groupContext,
  };
}

async function getRoomBoard(page: Page, propertyId: string): Promise<RoomBoardItem[]> {
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/operations/room-board`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read room board: HTTP ${response.status}`);
  }

  return response.body.map((room) => {
    const roomType = (room.roomType ?? {}) as LooseRecord;
    const currentStay = (room.currentStay ?? {}) as LooseRecord;
    const groupContext = (room.groupContext ?? null) as LooseRecord | null;

    return {
      roomId: String(room.roomId ?? room.id ?? ''),
      roomNumber: String(room.roomNumber ?? ''),
      roomTypeId: String(roomType.id ?? ''),
      roomTypeName: String(roomType.name ?? roomType.code ?? 'Room'),
      uiStatus: String(room.uiStatus ?? ''),
      operationalStatus: String(room.operationalStatus ?? ''),
      currentStayReservationId: String(currentStay.reservationId ?? ''),
      currentStayReservationCode: String(currentStay.reservationCode ?? ''),
      currentStayGuestName: String(currentStay.guestName ?? ''),
      currentStayStatus: String(currentStay.status ?? ''),
      groupContext,
    };
  });
}

async function getHousekeepingStatus(page: Page, propertyId: string, roomId: string) {
  const response = await apiRequest<LooseRecord[] | { rooms?: LooseRecord[] }>(page, {
    path: `/properties/${propertyId}/housekeeping/dashboard`,
  });

  if (!response.ok) {
    throw new Error(`Unable to read housekeeping dashboard: HTTP ${response.status}`);
  }

  const rooms = Array.isArray(response.body) ? response.body : (response.body.rooms ?? []);

  const room = rooms.find((item) => String(item.roomId ?? item.id ?? '') === roomId);

  if (!room) {
    throw new Error(`Room ${roomId} not found in housekeeping dashboard.`);
  }

  return String(room.status ?? room.uiStatus ?? room.operationalStatus ?? '').toLowerCase();
}

async function waitForRoomBoardStatus(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
    expected: string;
  },
) {
  await expect
    .poll(
      async () => {
        const room = await getRoomBoardItem(page, input.propertyId, input.roomId);
        return normalizeStatus(room.uiStatus || room.operationalStatus);
      },
      {
        timeout: 20_000,
        intervals: [300, 700, 1_500],
      },
    )
    .toBe(normalizeStatus(input.expected));
}

async function waitForRoomOperationalStatus(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
    expected: string;
  },
) {
  await expect
    .poll(
      async () => {
        const room = await getRoomBoardItem(page, input.propertyId, input.roomId);
        return normalizeStatus(room.operationalStatus);
      },
      {
        timeout: 20_000,
        intervals: [300, 700, 1_500],
      },
    )
    .toBe(normalizeStatus(input.expected));
}

async function waitForHousekeepingStatus(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
    expected: 'dirty' | 'cleaning' | 'inspection' | 'ready' | 'maintenance';
  },
) {
  await expect
    .poll(
      async () => {
        const status = await getHousekeepingStatus(page, input.propertyId, input.roomId);
        if (status.includes('needs_cleaning') || status.includes('needscleaning')) return 'dirty';
        if (status.includes('dirty')) return 'dirty';
        if (status.includes('cleaning')) return 'cleaning';
        if (status.includes('inspection')) return 'inspection';
        if (status.includes('maintenance')) return 'maintenance';
        if (status.includes('ready')) return 'ready';
        return status;
      },
      {
        timeout: 20_000,
        intervals: [300, 700, 1_500],
      },
    )
    .toBe(input.expected);
}

async function reportBlockingMaintenance(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
    roomNumber: string;
    titleSuffix: string;
  },
) {
  const title = `E2E blocking maintenance ${input.roomNumber} ${input.titleSuffix}`;

  const createResponse = await apiRequest<LooseRecord>(page, {
    method: 'POST',
    path: `/properties/${input.propertyId}/maintenance`,
    body: {
      roomId: input.roomId,
      title,
      description: 'E2E lifecycle maintenance issue',
      category: 'OTHER',
      priority: 'HIGH',
      makeRoomUnavailable: true,
    },
  });

  if (!createResponse.ok) {
    throw new Error(
      `Unable to create maintenance ticket: HTTP ${createResponse.status}\n${JSON.stringify(createResponse.body)}`,
    );
  }

  const ticketId = String(
    createResponse.body.id ?? createResponse.body._id ?? createResponse.body.uuid ?? '',
  );

  if (!ticketId) {
    throw new Error('Maintenance ticket created but no ticket id returned.');
  }

  return { ticketId, title };
}

async function resolveMaintenanceTicket(
  page: Page,
  propertyId: string,
  ticketId: string,
  note: string,
) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/maintenance/${ticketId}/resolve`,
    body: {
      resolutionNote: note,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to resolve maintenance ticket: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }
}

async function resolveMaintenanceAsMaintenanceRole(
  page: Page,
  input: {
    propertyId: string;
    ticketId: string;
    note: string;
  },
) {
  await loginAs(page, maintenanceEmail);
  await resolveMaintenanceTicket(page, input.propertyId, input.ticketId, input.note);
  await loginAs(page, frontDeskEmail);
}

async function getHousekeepingEmployeeId(page: Page, propertyId: string) {
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/employees?department=HOUSEKEEPING&status=ACTIVE`,
  });

  if (response.ok) {
    const employee = response.body.find((item) => String(item.id ?? '') !== '');
    const employeeId = String(employee?.id ?? '');
    if (employeeId) {
      return employeeId;
    }
  }

  // Some roles cannot list employees. Fall back to any assigned housekeeping employee id
  // already visible on the dashboard dataset.
  const dashboardResponse = await apiRequest<LooseRecord[] | { rooms?: LooseRecord[] }>(page, {
    path: `/properties/${propertyId}/housekeeping/dashboard`,
  });

  if (!dashboardResponse.ok) {
    throw new Error(
      `Unable to discover housekeeping employee for workflow completion: employees=${response.status}, dashboard=${dashboardResponse.status}`,
    );
  }

  const rooms = Array.isArray(dashboardResponse.body)
    ? dashboardResponse.body
    : (dashboardResponse.body.rooms ?? []);

  const assignedId = rooms
    .map((item) => String(item.assignedEmployeeId ?? item.assigned_employee_id ?? ''))
    .find(Boolean);

  if (!assignedId) {
    throw new Error(
      'No housekeeping employee id is available (employees endpoint denied and dashboard has no assigned staff).',
    );
  }

  return assignedId;
}

async function advanceHousekeepingFromDirtyToReady(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
  },
) {
  // Housekeeping mutations require a housekeeping-authorized session.
  // The maintenance helper switches us back to Front Desk after resolving,
  // so explicitly switch roles for the housekeeping lifecycle.
  await loginAs(page, housekeepingEmail);

  const employeeId = await getHousekeepingEmployeeId(page, input.propertyId);

  const assignResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/housekeeping/rooms/${input.roomId}/assign`,
    body: {
      employeeId,
    },
  });

  if (!assignResponse.ok) {
    throw new Error(
      `Unable to assign housekeeping room: HTTP ${assignResponse.status}\n${JSON.stringify(assignResponse.body)}`,
    );
  }

  const startResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/housekeeping/rooms/${input.roomId}/start`,
    body: {
      employeeId,
    },
  });

  if (!startResponse.ok) {
    throw new Error(
      `Unable to start cleaning: HTTP ${startResponse.status}\n${JSON.stringify(startResponse.body)}`,
    );
  }

  const completeResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/housekeeping/rooms/${input.roomId}/complete`,
    body: {
      employeeId,
      completedOnBehalf: true,
      checklist: HOUSEKEEPING_CHECKLIST_KEYS.map((key) => ({
        key,
        completed: true,
      })),
    },
  });

  if (!completeResponse.ok) {
    throw new Error(
      `Unable to complete cleaning: HTTP ${completeResponse.status}\n${JSON.stringify(completeResponse.body)}`,
    );
  }

  const inspectResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/housekeeping/rooms/${input.roomId}/inspect`,
    body: {
      action: 'APPROVE',
    },
  });

  if (!inspectResponse.ok) {
    throw new Error(
      `Unable to approve inspection: HTTP ${inspectResponse.status}\n${JSON.stringify(inspectResponse.body)}`,
    );
  }

  // Continue the rest of the scenario as Front Desk.
  await loginAs(page, frontDeskEmail);
}

async function prepareAndCompleteCheckIn(page: Page, propertyId: string, reservationId: string) {
  const workspaceResponse = await apiRequest<LooseRecord>(page, {
    path: `/properties/${propertyId}/reservations/${reservationId}/check-in-workspace`,
  });

  if (!workspaceResponse.ok) {
    throw new Error(`Unable to load check-in workspace: HTTP ${workspaceResponse.status}`);
  }

  const guest = (workspaceResponse.body.guest ?? {}) as LooseRecord;
  const fullName = String(guest.fullName ?? '').trim() || `E2E CheckIn ${Date.now()}`;
  const uniquePhone = `9${Date.now().toString().slice(-9)}`;

  const registrationResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/check-in/guest-registration`,
    body: {
      fullName,
      mobile: String(guest.mobile ?? '').trim() || uniquePhone,
      nationality: 'Indian',
      addressLine1: String(guest.address ?? '').trim() || '101 E2E Test Street',
      city: String(guest.city ?? '').trim() || 'Indore',
      state: String(guest.state ?? '').trim() || 'Madhya Pradesh',
      country: String(guest.country ?? '').trim() || 'India',
      purposeOfVisit: String(guest.purposeOfVisit ?? '').trim() || 'Leisure',
      isForeignNational: false,
    },
  });

  if (!registrationResponse.ok) {
    throw new Error(
      `Check-in guest registration failed: HTTP ${registrationResponse.status}\n${JSON.stringify(registrationResponse.body)}`,
    );
  }

  const identityResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/check-in/identity`,
    body: {
      idType: 'AADHAAR',
      idNumber: '123456789012',
      verified: true,
    },
  });

  if (!identityResponse.ok) {
    throw new Error(
      `Check-in identity verification failed: HTTP ${identityResponse.status}\n${JSON.stringify(identityResponse.body)}`,
    );
  }

  const paymentResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/check-in/payment-review`,
    body: {
      paymentReviewed: true,
      paymentMethod: 'CASH',
      notes: 'Reviewed by E2E maintenance lifecycle test',
    },
  });

  if (!paymentResponse.ok) {
    throw new Error(
      `Check-in payment review failed: HTTP ${paymentResponse.status}\n${JSON.stringify(paymentResponse.body)}`,
    );
  }

  const completeResponse = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/check-in`,
  });

  if (!completeResponse.ok) {
    throw new Error(
      `Complete check-in failed: HTTP ${completeResponse.status}\n${JSON.stringify(completeResponse.body)}`,
    );
  }
}

async function findCompatibleReadyRelocationRoom(
  page: Page,
  input: {
    propertyId: string;
    arrivalDate: string;
    departureDate: string;
    roomTypeId: string;
    excludeRoomId: string;
  },
): Promise<ReadyRoom> {
  const buildQuery = (withRoomType: boolean) => {
    const query = new URLSearchParams({
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      guestCount: '1',
      adults: '1',
      children: '0',
    });
    if (withRoomType) {
      query.set('roomTypeId', input.roomTypeId);
    }
    return query.toString();
  };

  const fetchTargets = async (withRoomType: boolean) => {
    const response = await apiRequest<LooseRecord[]>(page, {
      path: `/properties/${input.propertyId}/operations/available-rooms?${buildQuery(withRoomType)}`,
    });

    if (!response.ok) {
      throw new Error(`Unable to load relocation candidate rooms: HTTP ${response.status}`);
    }

    return response.body
      .map((room) => {
        const roomType = (room.roomType ?? {}) as LooseRecord;
        return {
          roomId: String(room.roomId ?? room.id ?? ''),
          roomNumber: String(room.roomNumber ?? ''),
          roomTypeId: String(roomType.id ?? ''),
          roomTypeName: String(roomType.name ?? roomType.code ?? 'Room'),
        };
      })
      .filter((room) => room.roomId && room.roomNumber && room.roomId !== input.excludeRoomId)
      .filter((room) => {
        const boardRoom = boardByRoomId.get(room.roomId);
        return boardRoom && !boardRoom.currentStayReservationId && !boardRoom.groupContext;
      });
  };

  const board = await getRoomBoard(page, input.propertyId);
  const boardByRoomId = new Map(board.map((room) => [room.roomId, room]));

  const sameTypeTargets = await fetchTargets(true);
  if (sameTypeTargets.length > 0) {
    return sameTypeTargets[0];
  }

  const fallbackTargets = await fetchTargets(false);
  if (fallbackTargets.length > 0) {
    return fallbackTargets[0];
  }

  throw new Error('No READY replacement room found for relocation.');
}

async function moveGuestRoom(
  page: Page,
  input: {
    propertyId: string;
    reservationId: string;
    roomId: string;
    reason: string;
  },
) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/reservations/${input.reservationId}/move-room`,
    body: {
      roomId: input.roomId,
      reason: input.reason,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to move guest room: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }
}

async function markRoomOperationalStatus(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
    status: 'maintenance' | 'out-of-service' | 'out-of-order';
    reason: string;
    note: string;
  },
) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/rooms/${input.roomId}/${input.status}`,
    body: {
      reason: input.reason,
      note: input.note,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Unable to mark room ${input.status}: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }
}

async function returnRoomToService(page: Page, propertyId: string, roomId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/rooms/${roomId}/return-to-service`,
  });

  if (!response.ok) {
    throw new Error(
      `Unable to return room to service: HTTP ${response.status}\n${JSON.stringify(response.body)}`,
    );
  }
}

async function openRoomsAndGetCard(page: Page, roomNumber: string) {
  await page.goto('/rooms');
  await expect(page.getByRole('heading', { name: 'Rooms', exact: true })).toBeVisible();
  const card = page.getByTestId(`room-card-${roomNumber}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  return card;
}

async function waitForRoomCardText(page: Page, roomNumber: string, text: RegExp) {
  // Navigate only once. The Rooms page enriches room cards asynchronously
  // (room-board + reservation data). Reloading inside expect.poll resets that
  // enrichment on every attempt and can keep the card stuck on its initial
  // READY state even though it later becomes RESERVED in the UI.
  await page.goto('/rooms');

  const card = page.getByTestId(`room-card-${roomNumber}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(text, { timeout: 25_000 });
}

async function cleanupConfirmedReservation(page: Page, propertyId: string, reservationId: string) {
  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}/unassign-room`,
  }).catch(() => undefined);

  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${propertyId}/reservations/${reservationId}`,
    body: {
      status: 'CANCELLED',
    },
  }).catch(() => undefined);
}

function toAmount(value: unknown) {
  const amount =
    typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', ''));
  return Number.isFinite(amount) ? amount : 0;
}

function getOutstandingFolioBalance(folio: LooseRecord) {
  const totals = (folio.totals ?? {}) as LooseRecord;

  const reportedBalance = toAmount(
    totals.balance ?? folio.balance ?? folio.outstandingBalance ?? folio.amountDue,
  );

  if (reportedBalance > 0) {
    return reportedBalance;
  }

  const total = toAmount(totals.total ?? folio.total);
  const paid = toAmount(totals.paid ?? folio.paid ?? folio.paidAmount);
  const computedBalance = total - paid;

  return computedBalance > 0 ? computedBalance : 0;
}

async function getMaintenanceTicketStatus(page: Page, propertyId: string, ticketId: string) {
  const response = await apiRequest<LooseRecord>(page, {
    path: `/properties/${propertyId}/maintenance/${ticketId}`,
  });

  if (!response.ok) {
    return '';
  }

  return normalizeStatus(String(response.body.status ?? ''));
}

async function restoreRoomAfterCheckoutIfNeeded(
  page: Page,
  input: {
    propertyId: string;
    roomId: string;
  },
) {
  const initial = await getHousekeepingStatus(page, input.propertyId, input.roomId).catch(() => '');

  if (initial.includes('ready') || initial.includes('maintenance')) {
    return;
  }

  const isDirtyLike = (value: string) =>
    value.includes('dirty') || value.includes('needs_cleaning') || value.includes('needscleaning');

  if (!isDirtyLike(initial)) {
    await waitForHousekeepingStatus(page, {
      propertyId: input.propertyId,
      roomId: input.roomId,
      expected: 'dirty',
    }).catch(() => undefined);
  }

  const current = await getHousekeepingStatus(page, input.propertyId, input.roomId).catch(() => '');
  if (!isDirtyLike(current)) {
    return;
  }

  await advanceHousekeepingFromDirtyToReady(page, {
    propertyId: input.propertyId,
    roomId: input.roomId,
  }).catch(() => undefined);

  await waitForHousekeepingStatus(page, {
    propertyId: input.propertyId,
    roomId: input.roomId,
    expected: 'ready',
  }).catch(() => undefined);
}

async function cleanupReservationViaCheckoutIfCheckedIn(
  page: Page,
  input: {
    propertyId: string;
    reservationId: string;
  },
) {
  const reservationResponse = await apiRequest<LooseRecord>(page, {
    path: `/properties/${input.propertyId}/reservations/${input.reservationId}`,
  });

  if (!reservationResponse.ok) {
    return;
  }

  const reservation = reservationResponse.body;
  const status = normalizeStatus(String(reservation.status ?? ''));

  if (status === 'CONFIRMED') {
    await cleanupConfirmedReservation(page, input.propertyId, input.reservationId).catch(
      () => undefined,
    );
    return;
  }

  if (status === 'CHECKED_OUT') {
    const checkedOutRoomId = String(reservation.roomId ?? '');
    if (checkedOutRoomId) {
      await restoreRoomAfterCheckoutIfNeeded(page, {
        propertyId: input.propertyId,
        roomId: checkedOutRoomId,
      });
    }
    return;
  }

  if (status !== 'CHECKED_IN') {
    return;
  }

  const roomAtCheckout = String(reservation.roomId ?? '');

  const folioResponse = await apiRequest<LooseRecord>(page, {
    path: `/properties/${input.propertyId}/reservations/${input.reservationId}/folio`,
  });

  if (folioResponse.ok) {
    const folio = folioResponse.body;
    const folioId = String(folio.id ?? folio.folioId ?? '');
    const outstandingBalance = getOutstandingFolioBalance(folio);

    if (folioId && outstandingBalance > 0.01) {
      await apiRequest<LooseRecord>(page, {
        method: 'POST',
        path: `/properties/${input.propertyId}/folios/${folioId}/payments`,
        body: {
          method: 'CASH',
          amount: outstandingBalance.toFixed(2),
          reference: 'E2E-CLEANUP',
          notes: 'Automatic cleanup for maintenance room lifecycle Playwright test',
        },
      }).catch(() => undefined);
    }
  }

  await apiRequest<LooseRecord>(page, {
    method: 'PATCH',
    path: `/properties/${input.propertyId}/reservations/${input.reservationId}/check-out`,
  }).catch(() => undefined);

  const afterCheckoutResponse = await apiRequest<LooseRecord>(page, {
    path: `/properties/${input.propertyId}/reservations/${input.reservationId}`,
  });

  const afterCheckout = afterCheckoutResponse.ok ? afterCheckoutResponse.body : reservation;
  const afterStatus = normalizeStatus(String(afterCheckout.status ?? ''));
  const checkedOutRoomId = String(afterCheckout.roomId ?? roomAtCheckout ?? '');

  if (afterStatus === 'CHECKED_OUT' && checkedOutRoomId) {
    await restoreRoomAfterCheckoutIfNeeded(page, {
      propertyId: input.propertyId,
      roomId: checkedOutRoomId,
    });
  }
}

async function resolveMaintenanceTicketIfStillOpen(
  page: Page,
  input: {
    propertyId: string;
    ticketId: string;
    note: string;
  },
) {
  if (!input.ticketId) {
    return;
  }

  const ticketStatus = await getMaintenanceTicketStatus(page, input.propertyId, input.ticketId);
  if (ticketStatus === 'RESOLVED' || ticketStatus === 'CANCELLED' || ticketStatus === '') {
    return;
  }

  await resolveMaintenanceAsMaintenanceRole(page, {
    propertyId: input.propertyId,
    ticketId: input.ticketId,
    note: input.note,
  }).catch(() => undefined);
}

async function findMaintenanceTicketByTitle(
  page: Page,
  propertyId: string,
  title: string,
): Promise<string> {
  const response = await apiRequest<LooseRecord[]>(page, {
    path: `/properties/${propertyId}/maintenance`,
  });

  if (!response.ok) {
    throw new Error(`Unable to list maintenance tickets: HTTP ${response.status}`);
  }

  const ticket = response.body.find((item) => String(item.title ?? '') === title);
  const ticketId = String(ticket?.id ?? ticket?._id ?? ticket?.uuid ?? '');

  if (!ticketId) {
    throw new Error(`Maintenance ticket "${title}" was created but could not be found.`);
  }

  return ticketId;
}

async function reportOccupiedMaintenanceViaUi(
  page: Page,
  input: {
    roomNumber: string;
    title: string;
  },
) {
  const roomCard = await openRoomsAndGetCard(page, input.roomNumber);
  await roomCard.click();

  const roomDrawer = page
    .locator('[role="dialog"]')
    .filter({ hasText: new RegExp(`Room ${input.roomNumber}`, 'i') })
    .first();

  await expect(roomDrawer).toBeVisible();

  const reportMaintenanceButton = roomDrawer.getByRole('button', {
    name: /^Maintenance/i,
  });
  await expect(reportMaintenanceButton).toBeVisible();
  await reportMaintenanceButton.click();

  const maintenanceModal = page
    .locator('[role="dialog"]')
    .filter({ hasText: /Guest relocation required\?/i })
    .last();

  await expect(maintenanceModal).toBeVisible();
  await expect(maintenanceModal.getByText('Guest relocation required?')).toBeVisible();
  await expect(maintenanceModal.getByText(/No, guest can stay in this room/i)).toBeVisible();
  await expect(maintenanceModal.getByText(/Yes, relocation required/i)).toBeVisible();

  const titleInput = maintenanceModal.getByLabel(/Issue/i);
  await expect(titleInput).toBeVisible();
  await titleInput.fill(input.title);

  const categoryInput = maintenanceModal.getByLabel(/Category/i);
  if (await categoryInput.isVisible().catch(() => false)) {
    await categoryInput.click();

    const otherOption = page.getByRole('option', { name: /^Other$/i });
    if (await otherOption.isVisible().catch(() => false)) {
      await otherOption.click();
    }
  }

  await maintenanceModal.getByText(/Yes, relocation required/i).click();

  await expect(
    maintenanceModal.getByText(
      /After reporting, we will immediately look for a replacement room for the in-house guest/i,
    ),
  ).toBeVisible();

  const submitButton = maintenanceModal.getByRole('button', {
    name: /Report Maintenance|Create Ticket|Report Issue/i,
  });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(maintenanceModal).toBeHidden({ timeout: 20_000 });
}

test.describe('maintenance room lifecycle regression', () => {
  test.setTimeout(150_000);

  test.beforeEach(() => {
    resetE2EPropertyState();
  });

  test('assigned room maintenance before check-in', async ({ page }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverReadyRoomPairForToday(page);
    const roomA = candidate.roomA;
    const preselectedRoomB = candidate.roomB;

    const guest = await createUniqueGuest(page, candidate.propertyId);
    const reservation = await createConfirmedReservation(page, {
      propertyId: candidate.propertyId,
      guestId: guest.guestId,
      roomTypeId: roomA.roomTypeId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
    });

    let cleanupDone = false;

    try {
      await test.step('assign READY Room A to confirmed reservation', async () => {
        await assignReservationRoom(
          page,
          candidate.propertyId,
          reservation.reservationId,
          roomA.roomId,
        );
      });

      await test.step('verify Room A is RESERVED for the guest before check-in', async () => {
        const currentReservation = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );

        expect(normalizeStatus(String(currentReservation.status ?? ''))).toBe('CONFIRMED');
        expect(String(currentReservation.roomId ?? '')).toBe(roomA.roomId);

        await waitForRoomCardText(page, roomA.roomNumber, /reserved/i);
        const roomCard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await expect(roomCard.getByText(/^Reserved$/i)).toBeVisible();
        await expect(roomCard).toContainText(guest.guestName);
        await expect(roomCard).toContainText(/Check In/i);
      });

      const maintenance =
        await test.step('report blocking maintenance on Room A before check-in', async () => {
          return reportBlockingMaintenance(page, {
            propertyId: candidate.propertyId,
            roomId: roomA.roomId,
            roomNumber: roomA.roomNumber,
            titleSuffix: `${Date.now()}`,
          });
        });

      await test.step('verify check-in is blocked while Room A is under maintenance', async () => {
        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'MAINTENANCE',
        });

        const currentReservation = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );

        expect(normalizeStatus(String(currentReservation.status ?? ''))).toBe('CONFIRMED');
        expect(String(currentReservation.roomId ?? '')).toBe(roomA.roomId);

        await page.goto(`/reservations/${reservation.reservationId}`);
        await expect(
          page.getByText(new RegExp(`Room ${roomA.roomNumber} is unavailable`, 'i')),
        ).toBeVisible();
        await expect(
          page.getByText(/Change the assigned room before starting check-in/i),
        ).toBeVisible();
        await expect(page.getByTestId('booking-next-action-cta')).toContainText(/Change Room/i);

        const roomCard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await expect(roomCard.getByText(/^Maintenance$/i)).toBeVisible();
        await expect(roomCard).not.toContainText(guest.guestName);
      });

      const roomB =
        await test.step('change the reservation from maintenance Room A to READY Room B', async () => {
          const target = await findCompatibleReadyRelocationRoom(page, {
            propertyId: candidate.propertyId,
            arrivalDate: candidate.arrivalDate,
            departureDate: candidate.departureDate,
            roomTypeId: roomA.roomTypeId,
            excludeRoomId: roomA.roomId,
          });

          await assignReservationRoom(
            page,
            candidate.propertyId,
            reservation.reservationId,
            target.roomId,
          );

          return target;
        });

      await test.step('verify Room A stays MAINTENANCE and Room B becomes RESERVED', async () => {
        const currentReservation = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );

        expect(normalizeStatus(String(currentReservation.status ?? ''))).toBe('CONFIRMED');
        expect(String(currentReservation.roomId ?? '')).toBe(roomB.roomId);

        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'MAINTENANCE',
        });

        await waitForRoomCardText(page, roomB.roomNumber, /reserved/i);

        const roomACard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await expect(roomACard.getByText(/^Maintenance$/i)).toBeVisible();
        await expect(roomACard).not.toContainText(guest.guestName);

        const roomBCard = await openRoomsAndGetCard(page, roomB.roomNumber);
        await expect(roomBCard.getByText(/^Reserved$/i)).toBeVisible();
        await expect(roomBCard).toContainText(guest.guestName);
        await expect(roomBCard).toContainText(/Check In/i);

        await page.goto(`/reservations/${reservation.reservationId}`);
        await expect(page.getByText(/is unavailable/i)).toHaveCount(0);
        await expect(page.getByTestId('booking-next-action-cta')).toContainText(
          /Start Check\s*-?\s*In/i,
        );
      });

      await test.step('resolve old Room A maintenance and complete housekeeping lifecycle', async () => {
        await resolveMaintenanceAsMaintenanceRole(page, {
          propertyId: candidate.propertyId,
          ticketId: maintenance.ticketId,
          note: 'Resolved after pre-check-in room change',
        });

        await waitForHousekeepingStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'dirty',
        });

        await advanceHousekeepingFromDirtyToReady(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
        });

        await waitForHousekeepingStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'ready',
        });
      });

      await test.step('complete check-in in Room B and verify Room B becomes OCCUPIED', async () => {
        await prepareAndCompleteCheckIn(page, candidate.propertyId, reservation.reservationId);

        await expect
          .poll(
            async () => {
              const current = await readReservation(
                page,
                candidate.propertyId,
                reservation.reservationId,
              );
              return {
                roomId: String(current.roomId ?? ''),
                status: normalizeStatus(String(current.status ?? '')),
              };
            },
            {
              timeout: 20_000,
              intervals: [300, 700, 1_500],
            },
          )
          .toEqual({ roomId: roomB.roomId, status: 'CHECKED_IN' });

        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomB.roomId,
          expected: 'OCCUPIED',
        });

        const roomBCard = await openRoomsAndGetCard(page, roomB.roomNumber);
        await expect(roomBCard.getByText(/^Occupied$/i)).toBeVisible();
        await expect(roomBCard).toContainText(guest.guestName);
        await expect(roomBCard).toContainText(/IN HOUSE/i);

        const roomACard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await expect(roomACard.getByText(/^Ready$/i)).toBeVisible();
      });

      await test.step('final state: Room A READY/VACANT and Room B OCCUPIED with same guest', async () => {
        const roomABoard = await getRoomBoardItem(page, candidate.propertyId, roomA.roomId);
        const roomBBoard = await getRoomBoardItem(page, candidate.propertyId, roomB.roomId);

        expect(normalizeStatus(roomABoard.uiStatus)).toBe('READY');
        expect(normalizeStatus(roomBBoard.uiStatus)).toBe('OCCUPIED');

        const currentReservation = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );

        expect(String(currentReservation.roomId ?? '')).toBe(roomB.roomId);
        expect(normalizeStatus(String(currentReservation.status ?? ''))).toBe('CHECKED_IN');

        const roomACard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await expect(roomACard.getByText(/^Ready$/i)).toBeVisible();
        await expect(roomACard).toContainText(/Vacant/i);
        await expect(roomACard).toContainText(/Assign Guest/i);
        await expect(roomACard).not.toContainText(guest.guestName);

        const roomBCard = await openRoomsAndGetCard(page, roomB.roomNumber);
        await expect(roomBCard.getByText(/^Occupied$/i)).toBeVisible();
        await expect(roomBCard).toContainText(guest.guestName);
        await expect(roomBCard).toContainText(/IN HOUSE/i);
      });

      cleanupDone = true;
    } finally {
      // Once the scenario has checked in, cancelling/unassigning would alter valid room/stay
      // lifecycle state. Only perform the legacy pre-check-in cleanup if the test failed
      // before check-in completed.
      if (!cleanupDone) {
        const current = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        ).catch(() => undefined);

        if (normalizeStatus(String(current?.status ?? '')) !== 'CHECKED_IN') {
          await cleanupConfirmedReservation(page, candidate.propertyId, reservation.reservationId);
        }
      }
    }
  });

  test('blocking maintenance after check-in requires guest relocation', async ({ page }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverReadyRoomPairForToday(page);
    const roomA = candidate.roomA;
    const preselectedRoomB = candidate.roomB;

    const guest = await createUniqueGuest(page, candidate.propertyId);
    const reservation = await createConfirmedReservation(page, {
      propertyId: candidate.propertyId,
      guestId: guest.guestId,
      roomTypeId: roomA.roomTypeId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
    });
    let maintenanceTicketId = '';
    let roomB: ReadyRoom | null = preselectedRoomB;

    try {
      await test.step('create confirmed reservation, assign READY Room A, and complete check-in', async () => {
        await assignReservationRoom(
          page,
          candidate.propertyId,
          reservation.reservationId,
          roomA.roomId,
        );
        await prepareAndCompleteCheckIn(page, candidate.propertyId, reservation.reservationId);
      });

      await test.step('verify stay is CHECKED_IN and Room A is OCCUPIED', async () => {
        await expect
          .poll(
            async () => {
              const current = await readReservation(
                page,
                candidate.propertyId,
                reservation.reservationId,
              );
              return normalizeStatus(String(current.status ?? ''));
            },
            {
              timeout: 20_000,
              intervals: [300, 700, 1_500],
            },
          )
          .toBe('CHECKED_IN');

        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'OCCUPIED',
        });
      });

      const maintenance =
        await test.step('report blocking maintenance on occupied Room A', async () => {
          return reportBlockingMaintenance(page, {
            propertyId: candidate.propertyId,
            roomId: roomA.roomId,
            roomNumber: roomA.roomNumber,
            titleSuffix: `${Date.now()}`,
          });
        });

      maintenanceTicketId = maintenance.ticketId;

      await test.step('verify Room A is MAINTENANCE, guest remains checked in, and relocation warning appears', async () => {
        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'MAINTENANCE',
        });

        const roomABoardBeforeRelocation = await getRoomBoardItem(
          page,
          candidate.propertyId,
          roomA.roomId,
        );
        expect(normalizeStatus(roomABoardBeforeRelocation.uiStatus)).toBe('MAINTENANCE');
        expect(roomABoardBeforeRelocation.currentStayReservationId).not.toBe('');
        expect(roomABoardBeforeRelocation.currentStayGuestName).not.toBe('');

        const current = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );
        expect(normalizeStatus(String(current.status ?? ''))).toBe('CHECKED_IN');
        expect(String(current.roomId ?? '')).toBe(roomA.roomId);

        await page.goto(`/guest-stay/${reservation.reservationId}`);
        const relocationAlert = page
          .getByRole('alert')
          .filter({ hasText: new RegExp(`Room ${roomA.roomNumber} requires relocation`, 'i') });

        await expect(relocationAlert).toBeVisible();
        await expect(
          relocationAlert.getByRole('button', {
            name: /Move Guest Now/i,
          }),
        ).toBeVisible();
      });

      await test.step('rooms drawer shows relocation flow for maintenance plus checked-in stay', async () => {
        const roomCard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await roomCard.click();

        const drawer = page
          .locator('[role="dialog"]')
          .filter({ hasText: new RegExp(`Room ${roomA.roomNumber}`, 'i') })
          .first();
        await expect(drawer).toBeVisible();

        await expect(drawer.getByText(/Guest Relocation Required/i)).toBeVisible();
        await expect(drawer.getByText(/IN HOUSE/i)).toBeVisible();
        await expect(drawer.getByText(/Move the guest to another ready room/i)).toBeVisible();

        await expect(drawer.getByText(/^Move Guest$/i)).toBeVisible();
        await expect(drawer.getByText(/^Open Stay$/i)).toBeVisible();
        await expect(drawer.getByText(/^View History$/i)).toBeVisible();

        await expect(drawer.getByText(/^Remove Assignment$/i)).toHaveCount(0);
        await expect(drawer.getByText(/before check-in/i)).toHaveCount(0);
        await expect(drawer.getByText(/upcoming booking/i)).toHaveCount(0);
      });

      roomB =
        await test.step('move guest to preselected READY Room B', async () => {
          await moveGuestRoom(page, {
            propertyId: candidate.propertyId,
            reservationId: reservation.reservationId,
            roomId: preselectedRoomB.roomId,
            reason: 'E2E relocation after maintenance block',
          });

          return preselectedRoomB;
        });

      if (!roomB) {
        throw new Error('Relocation target room was not selected.');
      }

      await test.step('verify stay moved to Room B, Room B is OCCUPIED, Room A remains MAINTENANCE, warning disappears', async () => {
        await expect
          .poll(
            async () => {
              const current = await readReservation(
                page,
                candidate.propertyId,
                reservation.reservationId,
              );
              return {
                roomId: String(current.roomId ?? ''),
                status: normalizeStatus(String(current.status ?? '')),
              };
            },
            {
              timeout: 20_000,
              intervals: [300, 700, 1_500],
            },
          )
          .toEqual({ roomId: roomB!.roomId, status: 'CHECKED_IN' });

        const roomABoard = await getRoomBoardItem(page, candidate.propertyId, roomA.roomId);
        const roomBBoard = await getRoomBoardItem(page, candidate.propertyId, roomB!.roomId);

        expect(normalizeStatus(roomABoard.uiStatus)).toBe('MAINTENANCE');
        expect(normalizeStatus(roomBBoard.uiStatus)).toBe('OCCUPIED');
        expect(roomABoard.currentStayReservationId ?? '').toBe('');
        expect(roomABoard.currentStayGuestName ?? '').toBe('');
        expect(roomBBoard.currentStayReservationId).toBe(reservation.reservationId);
        expect(normalizeStatus(roomBBoard.currentStayStatus ?? '')).toBe('CHECKED_IN');

        const hkStatusRoomA = await getHousekeepingStatus(page, candidate.propertyId, roomA.roomId);
        expect(hkStatusRoomA).toContain('maintenance');
        expect(hkStatusRoomA).not.toContain('dirty');

        await page.goto(`/guest-stay/${reservation.reservationId}`);
        const relocationAlert = page.getByRole('alert').filter({ hasText: /requires relocation/i });
        await expect(relocationAlert).toHaveCount(0);
      });

      await test.step('resolve maintenance for Room A and complete housekeeping lifecycle to READY', async () => {
        await resolveMaintenanceAsMaintenanceRole(page, {
          propertyId: candidate.propertyId,
          ticketId: maintenance.ticketId,
          note: 'Resolved after relocation in E2E flow',
        });

        await waitForHousekeepingStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'dirty',
        });

        await advanceHousekeepingFromDirtyToReady(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
        });

        await waitForHousekeepingStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'ready',
        });
      });

      await test.step('final assertions: Room A READY/VACANT, Room B OCCUPIED, reservation remains on Room B', async () => {
        const roomABoard = await getRoomBoardItem(page, candidate.propertyId, roomA.roomId);
        const roomBBoard = await getRoomBoardItem(page, candidate.propertyId, roomB!.roomId);

        expect(normalizeStatus(roomABoard.uiStatus)).toBe('READY');
        expect(normalizeStatus(roomBBoard.uiStatus)).toBe('OCCUPIED');

        const currentReservation = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );
        expect(String(currentReservation.roomId ?? '')).toBe(roomB!.roomId);
        expect(normalizeStatus(String(currentReservation.status ?? ''))).toBe('CHECKED_IN');

        const roomACard = await openRoomsAndGetCard(page, roomA.roomNumber);
        await expect(roomACard.getByText(/^Reserved$/i)).toHaveCount(0);
        await expect(roomACard.getByText(/^Ready$/i)).toBeVisible();
        await expect(roomACard).toContainText(/Vacant/i);

        const roomBCard = await openRoomsAndGetCard(page, roomB!.roomNumber);
        await expect(roomBCard.getByText(/^Occupied$/i)).toBeVisible();
        await expect(roomBCard).toContainText(guest.guestName);
      });
    } finally {
      await resolveMaintenanceTicketIfStillOpen(page, {
        propertyId: candidate.propertyId,
        ticketId: maintenanceTicketId,
        note: 'Automatic cleanup after maintenance relocation E2E test',
      }).catch(() => undefined);

      await cleanupReservationViaCheckoutIfCheckedIn(page, {
        propertyId: candidate.propertyId,
        reservationId: reservation.reservationId,
      }).catch(() => undefined);

      await restoreRoomAfterCheckoutIfNeeded(page, {
        propertyId: candidate.propertyId,
        roomId: roomA.roomId,
      }).catch(() => undefined);

      if (roomB?.roomId && roomB.roomId !== roomA.roomId) {
        await restoreRoomAfterCheckoutIfNeeded(page, {
          propertyId: candidate.propertyId,
          roomId: roomB.roomId,
        }).catch(() => undefined);
      }
    }
  });

  test('normal occupied room relocation sends source room to needs cleaning', async ({ page }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverReadyRoomPairForToday(page);
    const roomA = candidate.roomA;
    const roomB = candidate.roomB;
    const guest = await createUniqueGuest(page, candidate.propertyId);
    const reservation = await createConfirmedReservation(page, {
      propertyId: candidate.propertyId,
      guestId: guest.guestId,
      roomTypeId: roomA.roomTypeId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
    });

    try {
      await assignReservationRoom(
        page,
        candidate.propertyId,
        reservation.reservationId,
        roomA.roomId,
      );
      await prepareAndCompleteCheckIn(page, candidate.propertyId, reservation.reservationId);
      await waitForRoomBoardStatus(page, {
        propertyId: candidate.propertyId,
        roomId: roomA.roomId,
        expected: 'OCCUPIED',
      });

      await moveGuestRoom(page, {
        propertyId: candidate.propertyId,
        reservationId: reservation.reservationId,
        roomId: roomB.roomId,
        reason: 'E2E normal relocation',
      });

      const sourceRoom = await getRoomBoardItem(page, candidate.propertyId, roomA.roomId);
      const targetRoom = await getRoomBoardItem(page, candidate.propertyId, roomB.roomId);

      expect(normalizeStatus(sourceRoom.operationalStatus)).toBe('NEEDS_CLEANING');
      expect(normalizeStatus(targetRoom.uiStatus)).toBe('OCCUPIED');

      await advanceHousekeepingFromDirtyToReady(page, {
        propertyId: candidate.propertyId,
        roomId: roomA.roomId,
      });
      await waitForHousekeepingStatus(page, {
        propertyId: candidate.propertyId,
        roomId: roomA.roomId,
        expected: 'ready',
      });
    } finally {
      await cleanupReservationViaCheckoutIfCheckedIn(page, {
        propertyId: candidate.propertyId,
        reservationId: reservation.reservationId,
      }).catch(() => undefined);
      await restoreRoomAfterCheckoutIfNeeded(page, {
        propertyId: candidate.propertyId,
        roomId: roomA.roomId,
      }).catch(() => undefined);
      await restoreRoomAfterCheckoutIfNeeded(page, {
        propertyId: candidate.propertyId,
        roomId: roomB.roomId,
      }).catch(() => undefined);
    }
  });

  for (const manualStatus of ['maintenance', 'out-of-service', 'out-of-order'] as const) {
    test(`occupied room relocation preserves manual ${manualStatus} source state`, async ({
      page,
    }) => {
      await loginAs(page, frontDeskEmail);

      const candidate = await discoverReadyRoomPairForToday(page);
      const roomA = candidate.roomA;
      const roomB = candidate.roomB;
      const reason = `E2E ${manualStatus} issue`;
      const note = `Preserve ${manualStatus} during relocation`;
      const expectedStatus = normalizeStatus(manualStatus);
      const guest = await createUniqueGuest(page, candidate.propertyId);
      const reservation = await createConfirmedReservation(page, {
        propertyId: candidate.propertyId,
        guestId: guest.guestId,
        roomTypeId: roomA.roomTypeId,
        arrivalDate: candidate.arrivalDate,
        departureDate: candidate.departureDate,
      });

      try {
        await assignReservationRoom(
          page,
          candidate.propertyId,
          reservation.reservationId,
          roomA.roomId,
        );
        await prepareAndCompleteCheckIn(page, candidate.propertyId, reservation.reservationId);
        await markRoomOperationalStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          status: manualStatus,
          reason,
          note,
        });

        await waitForRoomOperationalStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: expectedStatus,
        });

        await moveGuestRoom(page, {
          propertyId: candidate.propertyId,
          reservationId: reservation.reservationId,
          roomId: roomB.roomId,
          reason: `E2E relocation from ${manualStatus}`,
        });

        const sourceRoom = await getRoomBoardItem(page, candidate.propertyId, roomA.roomId);
        const targetRoom = await getRoomBoardItem(page, candidate.propertyId, roomB.roomId);

        expect(normalizeStatus(sourceRoom.operationalStatus)).toBe(expectedStatus);
        expect(normalizeStatus(targetRoom.uiStatus)).toBe('OCCUPIED');

        await returnRoomToService(page, candidate.propertyId, roomA.roomId);
        await waitForHousekeepingStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'dirty',
        });
        await advanceHousekeepingFromDirtyToReady(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
        });
        await waitForHousekeepingStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'ready',
        });
      } finally {
        await cleanupReservationViaCheckoutIfCheckedIn(page, {
          propertyId: candidate.propertyId,
          reservationId: reservation.reservationId,
        }).catch(() => undefined);
        await restoreRoomAfterCheckoutIfNeeded(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
        }).catch(() => undefined);
        await restoreRoomAfterCheckoutIfNeeded(page, {
          propertyId: candidate.propertyId,
          roomId: roomB.roomId,
        }).catch(() => undefined);
      }
    });
  }

  test('occupied room blocking maintenance opens relocation flow immediately', async ({ page }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverReadyRoomPairForToday(page);
    const roomA = candidate.roomA;
    const preselectedRoomB = candidate.roomB;
    const guest = await createUniqueGuest(page, candidate.propertyId);
    const reservation = await createConfirmedReservation(page, {
      propertyId: candidate.propertyId,
      guestId: guest.guestId,
      roomTypeId: roomA.roomTypeId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
    });

    const maintenanceTitle = `E2E UI relocation ${roomA.roomNumber} ${Date.now()}`;
    let maintenanceTicketId = '';

    try {
      await test.step('check the guest into Room A with preselected READY replacement Room B', async () => {
        await assignReservationRoom(
          page,
          candidate.propertyId,
          reservation.reservationId,
          roomA.roomId,
        );
        await prepareAndCompleteCheckIn(page, candidate.propertyId, reservation.reservationId);

        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'OCCUPIED',
        });

        const replacementBoard = await getRoomBoardItem(
          page,
          candidate.propertyId,
          preselectedRoomB.roomId,
        );
        expect(normalizeStatus(replacementBoard.uiStatus)).toBe('READY');
        expect(replacementBoard.currentStayReservationId ?? '').toBe('');
        expect(replacementBoard.groupContext ?? null).toBeNull();
      });

      await test.step('report blocking maintenance from the occupied-room UI', async () => {
        await reportOccupiedMaintenanceViaUi(page, {
          roomNumber: roomA.roomNumber,
          title: maintenanceTitle,
        });

        maintenanceTicketId = await findMaintenanceTicketByTitle(
          page,
          candidate.propertyId,
          maintenanceTitle,
        );
      });

      await test.step('verify relocation flow opens without moving or unassigning the guest', async () => {
        await waitForRoomBoardStatus(page, {
          propertyId: candidate.propertyId,
          roomId: roomA.roomId,
          expected: 'MAINTENANCE',
        });

        const currentReservation = await readReservation(
          page,
          candidate.propertyId,
          reservation.reservationId,
        );

        expect(normalizeStatus(String(currentReservation.status ?? ''))).toBe('CHECKED_IN');
        expect(String(currentReservation.roomId ?? '')).toBe(roomA.roomId);

        const relocationDialog = page
          .locator('[role="dialog"]')
          .filter({ hasText: /Move Guest|Change Room/i })
          .last();

        await expect(relocationDialog).toBeVisible({ timeout: 20_000 });

        await expect(relocationDialog.getByText(/no replacement room available/i)).toHaveCount(0);

        await expect(relocationDialog).toContainText(preselectedRoomB.roomNumber);

        // Reporting blocking maintenance must not itself move the stay.
        const roomABoard = await getRoomBoardItem(page, candidate.propertyId, roomA.roomId);
        expect(normalizeStatus(roomABoard.uiStatus)).toBe('MAINTENANCE');
        expect(roomABoard.currentStayReservationId).toBe(reservation.reservationId);
      });
    } finally {
      await resolveMaintenanceTicketIfStillOpen(page, {
        propertyId: candidate.propertyId,
        ticketId: maintenanceTicketId,
        note: 'Automatic cleanup after occupied-room relocation UI E2E test',
      }).catch(() => undefined);

      await cleanupReservationViaCheckoutIfCheckedIn(page, {
        propertyId: candidate.propertyId,
        reservationId: reservation.reservationId,
      }).catch(() => undefined);

      await restoreRoomAfterCheckoutIfNeeded(page, {
        propertyId: candidate.propertyId,
        roomId: roomA.roomId,
      }).catch(() => undefined);

      await restoreRoomAfterCheckoutIfNeeded(page, {
        propertyId: candidate.propertyId,
        roomId: preselectedRoomB.roomId,
      }).catch(() => undefined);
    }
  });
});
