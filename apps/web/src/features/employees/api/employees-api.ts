import { API_BASE_URL } from '../../../lib/inventory-api';
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeDepartment,
  EmployeeFilters,
  EmployeeStatus,
  UpdateEmployeePayload,
} from '../types/employee.types';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };
type LooseRecord = Record<string, unknown>;

export class EmployeeApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'EmployeeApiError';
    this.status = status;
    this.code = code;
  }
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
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getErrorCode(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as LooseRecord;
  if (typeof record.code === 'string') return record.code;
  if (record.error && typeof record.error === 'object') {
    const error = record.error as LooseRecord;
    if (typeof error.code === 'string') return error.code;
  }
  return undefined;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as LooseRecord;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const error = record.error as LooseRecord;
    if (typeof error.message === 'string') return error.message;
  }
  return fallback;
}

function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    throw new EmployeeApiError(
      getErrorMessage(payload, `Employee request failed: ${response.status}`),
      response.status,
      getErrorCode(payload),
    );
  }

  return unwrapResponse(payload);
}

function mapStatus(value?: string): EmployeeStatus {
  return value?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
}

function mapDepartment(value?: string): EmployeeDepartment {
  const normalized = value?.toUpperCase();
  const departments: EmployeeDepartment[] = [
    'HOUSEKEEPING',
    'MAINTENANCE',
    'FRONT_DESK',
    'ACCOUNTS',
    'RESTAURANT',
    'KITCHEN',
    'LAUNDRY',
    'SECURITY',
    'SPA',
    'OTHER',
  ];
  return departments.find((department) => department === normalized) ?? 'OTHER';
}

function mapEmployee(dto: LooseRecord): Employee {
  const firstName = getString(dto, ['firstName', 'first_name']);
  const lastName = getString(dto, ['lastName', 'last_name']);
  const displayName = getString(
    dto,
    ['displayName', 'display_name', 'name'],
    `${firstName} ${lastName}`.trim(),
  );

  return {
    department: mapDepartment(getString(dto, ['department'])),
    designation: getString(dto, ['designation', 'role']) || undefined,
    displayName: displayName || 'Employee',
    employeeCode: getString(dto, ['employeeCode', 'employee_code', 'code']) || undefined,
    firstName,
    id: getString(dto, ['id', '_id', 'uuid', 'employeeId']),
    lastName: lastName || undefined,
    phone: getString(dto, ['phone', 'mobile']) || undefined,
    status: mapStatus(getString(dto, ['status'])),
  };
}

function queryString(filters?: EmployeeFilters) {
  const params = new URLSearchParams();
  if (filters?.department) params.set('department', filters.department);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getEmployees(
  propertyId: string,
  filters?: EmployeeFilters,
  signal?: AbortSignal,
) {
  return request<LooseRecord[]>(
    `/properties/${propertyId}/employees${queryString(filters)}`,
    { signal },
  ).then((employees) => employees.map(mapEmployee));
}

export function getEmployee(propertyId: string, employeeId: string, signal?: AbortSignal) {
  return request<LooseRecord>(`/properties/${propertyId}/employees/${employeeId}`, {
    signal,
  }).then(mapEmployee);
}

export function createEmployee(propertyId: string, payload: CreateEmployeePayload) {
  return request<LooseRecord>(`/properties/${propertyId}/employees`, {
    body: JSON.stringify(cleanPayload(payload)),
    method: 'POST',
  }).then(mapEmployee);
}

export function updateEmployee(
  propertyId: string,
  employeeId: string,
  payload: UpdateEmployeePayload,
) {
  return request<LooseRecord>(`/properties/${propertyId}/employees/${employeeId}`, {
    body: JSON.stringify(cleanPayload(payload)),
    method: 'PATCH',
  }).then(mapEmployee);
}

export function friendlyEmployeeError(error: unknown) {
  if (error instanceof EmployeeApiError) {
    if (error.code === 'EMPLOYEE_CODE_ALREADY_EXISTS') {
      return 'An employee with this code already exists.';
    }
    if (error.code === 'FORBIDDEN' || error.status === 403) {
      return 'You do not have permission to manage employees.';
    }
  }
  return 'Unable to save employee. Please try again.';
}

