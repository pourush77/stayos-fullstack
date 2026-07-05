import { API_BASE_URL, getProperties } from '../../../lib/inventory-api';
import { type OperationsRoomBoardItemDto } from '../../../lib/operations-api';
import { createChecklist } from '../utils/housekeeping-checklist';
import type {
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
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `Housekeeping request failed: ${response.status}`;
    throw new Error(message);
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

function getRecord(record: LooseRecord | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as LooseRecord;
  }
  return undefined;
}

function normalizeStatus(value?: string): HousekeepingStatus {
  const normalized = (value ?? '').toUpperCase().replace(/[\s_-]/g, '');
  if (normalized.includes('CLEANING')) return 'cleaning';
  if (normalized.includes('INSPECTION')) return 'inspection';
  if (normalized.includes('MAINTENANCE')) return 'maintenance';
  if (normalized.includes('OUTOFORDER')) return 'out-of-order';
  if (normalized.includes('OUTOFSERVICE') || normalized.includes('UNAVAILABLE'))
    return 'out-of-service';
  if (normalized.includes('READY') || normalized.includes('CLEAN')) return 'ready';
  return 'dirty';
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
  const text = error instanceof Error ? error.message.toLowerCase() : '';
  if (text.includes('inactive')) return 'This staff member is inactive.';
  if (text.includes('department')) return 'Please select a housekeeping staff member.';
  if (text.includes('checklist'))
    return 'Please complete all cleaning items before sending for inspection.';
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
    status: getString(dto, ['status'], 'ACTIVE'),
  };
}

export function mapHousekeepingRoom(dto: OperationsRoomBoardItemDto): HousekeepingRoom {
  const raw = dto as unknown as LooseRecord;
  const assignment =
    getRecord(raw, ['housekeepingAssignment', 'assignment', 'housekeeping']) ?? raw;
  const floor =
    dto.floor.name ??
    dto.floor.code ??
    (dto.floor.floorNumber ? `Floor ${dto.floor.floorNumber}` : 'Floor');
  return {
    assignedEmployeeId:
      getString(assignment, ['assignedEmployeeId', 'assigned_employee_id']) || undefined,
    assignedEmployeeName:
      getString(assignment, ['assignedEmployeeName', 'assigned_employee_name', 'assignedStaff']) ||
      undefined,
    checklist: checklistFrom(assignment.checklist),
    completedAt: getString(assignment, ['completedAt', 'completed_at']) || undefined,
    completedByEmployeeId:
      getString(assignment, ['completedByEmployeeId', 'completed_by_employee_id']) || undefined,
    completedByUserId:
      getString(assignment, ['completedByUserId', 'completed_by_user_id']) || undefined,
    completedOnBehalf: getBoolean(assignment, ['completedOnBehalf', 'completed_on_behalf']),
    floor,
    id: dto.roomId,
    inspectedAt: getString(assignment, ['inspectedAt', 'inspected_at']) || undefined,
    inspectedByUserId:
      getString(assignment, ['inspectedByUserId', 'inspected_by_user_id']) || undefined,
    number: dto.roomNumber,
    reworkReason: getString(assignment, ['reworkReason', 'rework_reason']) || undefined,
    roomType: dto.roomType.name,
    startedAt: getString(assignment, ['startedAt', 'started_at']) || undefined,
    status: normalizeStatus(String(dto.uiStatus ?? dto.operationalStatus ?? '')),
    updatedAt: getString(assignment, ['updatedAt', 'updated_at']) || undefined,
  };
}

function mapHousekeepingRoomFromDashboard(dto: LooseRecord): HousekeepingRoom {
  const floor = getString(dto, ['floor', 'floorName', 'floorLabel'], 'Floor');

  return {
    assignedEmployeeId: getString(dto, ['assignedEmployeeId', 'assigned_employee_id']) || undefined,
    assignedEmployeeName:
      getString(dto, ['assignedEmployeeName', 'assigned_employee_name', 'assignedStaff']) ||
      undefined,
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
  return request<LooseRecord[] | { rooms?: LooseRecord[] }>(
    `/properties/${propertyId}/housekeeping/dashboard`,
    { signal },
  ).then((response) => {
    const rooms = Array.isArray(response) ? response : (response.rooms ?? []);
    return rooms.map((room) => mapHousekeepingRoomFromDashboard(room));
  });
}

export function getHousekeepingEmployees(propertyId: string, signal?: AbortSignal) {
  return request<LooseRecord[]>(
    `/properties/${propertyId}/employees?department=HOUSEKEEPING&status=ACTIVE`,
    { signal },
  ).then((employees) => employees.map(mapEmployee));
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
  payload: { employeeId: string; completedOnBehalf: boolean; checklist: unknown[] },
) {
  return request<unknown>(`/properties/${propertyId}/housekeeping/rooms/${roomId}/complete`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}

export function inspectHousekeepingRoom(
  propertyId: string,
  roomId: string,
  payload: { action: HousekeepingInspectAction; reason?: string },
) {
  return request<unknown>(`/properties/${propertyId}/housekeeping/rooms/${roomId}/inspect`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}
