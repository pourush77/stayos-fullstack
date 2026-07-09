import { API_BASE_URL, getProperties } from '../../../lib/inventory-api';
import { createChecklist } from '../utils/housekeeping-checklist';
import type {
  HousekeepingChecklistKey,
  HousekeepingDashboardSummary,
  HousekeepingChecklistItem,
  HousekeepingEmployee,
  HousekeepingInspectAction,
  HousekeepingRoom,
  HousekeepingStatus,
} from '../types/housekeeping.types';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };
type LooseRecord = Record<string, unknown>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => undefined)) as
    ApiResponse<T> | { code?: string; error?: string; message?: string } | undefined;

  if (!response.ok) {
    const code =
      payload && typeof payload === 'object' && 'code' in payload && payload.code
        ? String(payload.code)
        : '';
    const message =
      payload && typeof payload === 'object' && 'message' in payload && payload.message
        ? String(payload.message)
        : `Housekeeping request failed: ${response.status}`;
    throw new Error([code, message].filter(Boolean).join(': '));
  }

  return unwrapResponse(payload as ApiResponse<T>);
}

function unwrapResponse<T>(response: ApiResponse<T> | undefined): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }
  return response as T;
}

function getString(record: LooseRecord | undefined, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function getBoolean(record: LooseRecord | undefined, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'boolean') return value;
  }
  return fallback;
}

function getNumber(record: LooseRecord | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function normalizeStatus(value?: string): HousekeepingStatus {
  const normalized = (value ?? '').toUpperCase().replace(/[\s_-]/g, '');

  if (normalized === 'NEEDSCLEANING' || normalized === 'DIRTY' || normalized === 'VACANTDIRTY') {
    return 'dirty';
  }

  if (normalized === 'CLEANING' || normalized === 'INPROGRESS') {
    return 'cleaning';
  }

  if (normalized === 'OCCUPIED' || normalized === 'INHOUSE' || normalized === 'GUESTSTAYING') {
    return 'occupied';
  }

  if (normalized.includes('INSPECTION')) return 'inspection';
  if (normalized.includes('MAINTENANCE')) return 'maintenance';
  if (normalized.includes('OUTOFORDER')) return 'out-of-order';
  if (normalized.includes('OUTOFSERVICE') || normalized.includes('UNAVAILABLE'))
    return 'out-of-service';
  if (normalized.includes('READY') || normalized === 'CLEAN') return 'ready';

  return 'dirty';
}

function normalizeSummary(value: unknown): HousekeepingDashboardSummary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as LooseRecord;
  return {
    cleaning: getNumber(record, ['cleaning', 'inProgress', 'in_progress', 'IN_PROGRESS']),
    dirty: getNumber(record, ['dirty', 'needsCleaning', 'needs_cleaning', 'NEEDS_CLEANING']),
    inspection: getNumber(record, ['inspection', 'waitingInspection', 'waiting_inspection']),
    maintenance: getNumber(record, ['maintenance']),
    occupied: getNumber(record, ['occupied', 'OCCUPIED']),
    outOfOrder: getNumber(record, ['outOfOrder', 'out_of_order']),
    outOfService: getNumber(record, ['outOfService', 'out_of_service']),
    ready: getNumber(record, ['ready', 'READY']),
  };
}

function checklistFrom(value: unknown): HousekeepingChecklistItem[] {
  if (!Array.isArray(value)) return createChecklist();
  const completedKeys = value
    .filter((item): item is LooseRecord => Boolean(item) && typeof item === 'object')
    .filter((item) => item.completed === true || item.complete === true)
    .map((item) => getString(item, ['key']).toUpperCase())
    .filter(Boolean) as never[];
  return createChecklist(completedKeys);
}

export async function getCurrentPropertyId(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const active = properties.find((property) => {
    const status = getString(property, ['status'], 'ACTIVE').toUpperCase();
    return status === 'ACTIVE' || status === 'OPEN';
  });
  const id = getString(active, ['id', '_id', 'uuid', 'propertyId']);
  if (!id) throw new Error('No active property returned.');
  return id;
}

export function friendlyHousekeepingError(error: unknown) {
  const raw = error instanceof Error ? error.message : '';
  const code = raw.split(':')[0]?.trim().toUpperCase();
  if (code === 'EMPLOYEE_NOT_FOUND') return 'This staff member was not found.';
  if (code === 'EMPLOYEE_INACTIVE') return 'This staff member is inactive.';
  if (code === 'EMPLOYEE_NOT_HOUSEKEEPING') return 'Please select a housekeeping staff member.';
  if (code === 'CHECKLIST_INCOMPLETE') return 'Please complete all checklist items.';
  if (code === 'FORBIDDEN') return 'You do not have permission to update housekeeping rooms.';

  const text = raw.toLowerCase();
  if (text.includes('not found')) return 'This staff member was not found.';
  if (text.includes('inactive')) return 'This staff member is inactive.';
  if (text.includes('department')) return 'Please select a housekeeping staff member.';
  if (text.includes('checklist')) return 'Please complete all checklist items.';
  if (text.includes('not ready') || text.includes('invalid') || text.includes('transition')) {
    return 'This room is not ready for this action.';
  }
  if (text.includes('forbidden') || text.includes('permission') || text.includes('403')) {
    return 'You do not have permission to update housekeeping rooms.';
  }
  return 'Unable to update this room. Please try again.';
}

export function mapEmployee(dto: LooseRecord): HousekeepingEmployee {
  const firstName = getString(dto, ['firstName', 'first_name']);
  const lastName = getString(dto, ['lastName', 'last_name']);
  const displayName = getString(
    dto,
    ['displayName', 'display_name', 'name'],
    `${firstName} ${lastName}`.trim(),
  );
  return {
    department: getString(dto, ['department'], 'HOUSEKEEPING'),
    designation: getString(dto, ['designation', 'role'], 'Housekeeping'),
    displayName: displayName || 'Housekeeping Staff',
    employeeCode: getString(dto, ['employeeCode', 'employee_code', 'code']),
    firstName,
    id: getString(dto, ['id', '_id', 'uuid', 'employeeId']),
    lastName,
    phone: getString(dto, ['phone', 'mobile']) || undefined,
    propertyName: getString(dto, ['propertyName', 'property_name']) || undefined,
    status: getString(dto, ['status'], 'ACTIVE'),
    staffAccessEnabled: getBoolean(
      dto,
      ['staffAccessEnabled', 'staff_access_enabled', 'accessEnabled', 'access_enabled'],
      Boolean(getString(dto, ['staffAccessToken', 'staff_access_token', 'accessToken'])),
    ),
    staffAccessToken:
      getString(dto, ['staffAccessToken', 'staff_access_token', 'accessToken']) || undefined,
  };
}

function mapHousekeepingRoomFromDashboard(dto: LooseRecord): HousekeepingRoom {
  const floor = getString(dto, ['floor', 'floorName', 'floorLabel'], 'Floor');

  return {
    assignedEmployeeId:
      getString(dto, [
        'assignedEmployeeId',
        'assigned_employee_id',
        'assignedStaffId',
        'assigned_staff_id',
        'employeeId',
        'employee_id',
      ]) || undefined,

    assignedEmployeeName:
      getString(dto, [
        'assignedEmployeeName',
        'assigned_employee_name',
        'assignedStaff',
        'assignedStaffName',
        'assigned_staff_name',
        'employeeName',
        'employee_name',
      ]) || undefined,
    checklist: checklistFrom(dto.checklist),
    completedAt: getString(dto, ['completedAt', 'completed_at']) || undefined,
    completedByEmployeeId:
      getString(dto, ['completedByEmployeeId', 'completed_by_employee_id']) || undefined,
    completedByUserId: getString(dto, ['completedByUserId', 'completed_by_user_id']) || undefined,
    completedOnBehalf: getBoolean(dto, ['completedOnBehalf', 'completed_on_behalf']),
    floor,
    id: getString(dto, ['roomId', 'id']),
    inspectedAt: getString(dto, ['inspectedAt', 'inspected_at']) || undefined,
    inspectedByUserId: getString(dto, ['inspectedByUserId', 'inspected_by_user_id']) || undefined,
    number: getString(dto, ['roomNumber', 'number']),
    reworkReason: getString(dto, ['reworkReason', 'rework_reason']) || undefined,
    roomType: getString(dto, ['roomType', 'roomTypeName'], 'Room'),
    startedAt: getString(dto, ['startedAt', 'started_at']) || undefined,
    status: normalizeStatus(getString(dto, ['status', 'uiStatus', 'operationalStatus'])),
    updatedAt: getString(dto, ['updatedAt', 'updated_at', 'lastActivityAt']) || undefined,
  };
}

export async function getHousekeepingDashboard(propertyId: string, signal?: AbortSignal) {
  const dashboard = await getHousekeepingDashboardData(propertyId, signal);
  return dashboard.rooms;
}

export async function getHousekeepingDashboardData(propertyId: string, signal?: AbortSignal) {
  return request<LooseRecord[] | { rooms?: LooseRecord[]; summary?: unknown }>(
    `/properties/${propertyId}/housekeeping/dashboard`,
    { signal },
  ).then((response) => {
    const rooms = Array.isArray(response) ? response : (response.rooms ?? []);
    const mappedRooms = rooms.map((room) => mapHousekeepingRoomFromDashboard(room));
    const summary = Array.isArray(response) ? undefined : normalizeSummary(response.summary);
    return { rooms: mappedRooms, summary };
  });
}

export function getHousekeepingEmployees(propertyId: string, signal?: AbortSignal) {
  return request<LooseRecord[]>(
    `/properties/${propertyId}/employees?department=HOUSEKEEPING&status=ACTIVE`,
    { signal },
  ).then((employees) => employees.map(mapEmployee));
}

export function regenerateStaffAccess(propertyId: string, employeeId: string) {
  return request<LooseRecord>(
    `/properties/${propertyId}/employees/${employeeId}/staff-access/regenerate`,
    { method: 'POST' },
  ).then(mapEmployee);
}

export function updateStaffAccess(
  propertyId: string,
  employeeId: string,
  enabled: boolean,
) {
  return request<LooseRecord>(`/properties/${propertyId}/employees/${employeeId}/staff-access`, {
    body: JSON.stringify({ enabled }),
    method: 'PATCH',
  }).then(mapEmployee);
}

export async function getStaffWorklistByToken(
  propertyId: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await request<
    LooseRecord[] | { employee?: LooseRecord; property?: LooseRecord; rooms?: LooseRecord[] }
  >(`/properties/${propertyId}/housekeeping/staff/access/${encodeURIComponent(token)}`, { signal });
  const rooms = Array.isArray(response) ? response : (response.rooms ?? []);
  const employee = Array.isArray(response)
    ? undefined
    : response.employee
      ? mapEmployee(response.employee)
      : undefined;
  const propertyName = Array.isArray(response)
    ? undefined
    : getString(response.property, ['name', 'displayName', 'propertyName']);

  return {
    employee,
    propertyName,
    rooms: rooms.map((room) => mapHousekeepingRoomFromDashboard(room)),
  };
}

export function startStaffRoomByToken(propertyId: string, token: string, roomId: string) {
  return request<unknown>(
    `/properties/${propertyId}/housekeeping/staff/access/${encodeURIComponent(token)}/rooms/${roomId}/start`,
    { method: 'PATCH' },
  );
}

export function completeStaffRoomByToken(
  propertyId: string,
  token: string,
  roomId: string,
  payload: { checklist: Array<{ key: HousekeepingChecklistKey; completed: boolean }> },
) {
  return request<unknown>(
    `/properties/${propertyId}/housekeeping/staff/access/${encodeURIComponent(token)}/rooms/${roomId}/complete`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );
}

export async function getStaffAccessWorklist(token: string, signal?: AbortSignal) {
  const response = await request<
    LooseRecord[] | { employee?: LooseRecord; property?: LooseRecord; rooms?: LooseRecord[] }
  >(`/housekeeping/staff/access/${encodeURIComponent(token)}`, { signal });
  const rooms = Array.isArray(response) ? response : (response.rooms ?? []);
  const employee = Array.isArray(response)
    ? undefined
    : response.employee
      ? mapEmployee(response.employee)
      : undefined;
  const propertyName = Array.isArray(response)
    ? undefined
    : getString(response.property, ['name', 'displayName', 'propertyName']);

  return {
    employee,
    propertyName,
    rooms: rooms.map((room) => mapHousekeepingRoomFromDashboard(room)),
  };
}

export function startStaffAccessRoom(token: string, roomId: string) {
  return request<unknown>(
    `/housekeeping/staff/access/${encodeURIComponent(token)}/rooms/${roomId}/start`,
    { method: 'PATCH' },
  );
}

export function completeStaffAccessRoom(
  token: string,
  roomId: string,
  payload: { checklist: Array<{ key: HousekeepingChecklistKey; completed: boolean }> },
) {
  return request<unknown>(
    `/housekeeping/staff/access/${encodeURIComponent(token)}/rooms/${roomId}/complete`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );
}

export function createHousekeepingEmployee(
  propertyId: string,
  payload: {
    firstName: string;
    lastName: string;
    displayName: string;
    phone?: string;
    status: string;
  },
) {
  return request<LooseRecord>(`/properties/${propertyId}/employees`, {
    body: JSON.stringify({ ...payload, department: 'HOUSEKEEPING' }),
    method: 'POST',
  }).then(mapEmployee);
}

export function updateHousekeepingEmployee(
  propertyId: string,
  employeeId: string,
  payload: Partial<HousekeepingEmployee>,
) {
  return request<LooseRecord>(`/properties/${propertyId}/employees/${employeeId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  }).then(mapEmployee);
}

export function assignHousekeepingRoom(propertyId: string, roomId: string, employeeId: string) {
  return request<unknown>(`/properties/${propertyId}/housekeeping/rooms/${roomId}/assign`, {
    body: JSON.stringify({ employeeId }),
    method: 'PATCH',
  });
}

export function startHousekeepingRoom(propertyId: string, roomId: string, employeeId?: string) {
  return request<unknown>(`/properties/${propertyId}/housekeeping/rooms/${roomId}/start`, {
    body: JSON.stringify({ employeeId }),
    method: 'PATCH',
  });
}

export function completeHousekeepingRoom(
  propertyId: string,
  roomId: string,
  payload: {
    employeeId: string;
    completedOnBehalf: boolean;
    checklist: Array<{ key: HousekeepingChecklistKey; completed: boolean }>;
  },
) {
  return request<unknown>(`/properties/${propertyId}/housekeeping/rooms/${roomId}/complete`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}

export function inspectHousekeepingRoom(
  propertyId: string,
  roomId: string,
  payload: { action: HousekeepingInspectAction; reworkReason?: string },
) {
  return request<unknown>(`/properties/${propertyId}/housekeeping/rooms/${roomId}/inspect`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}
