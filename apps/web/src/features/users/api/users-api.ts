import { API_BASE_URL } from '../../../lib/api-base';
import type {
  CreateUserPayload,
  PlatformUser,
  UpdateUserPayload,
  UserRole,
  UserStatus,
} from '../types/user.types';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };
type LooseRecord = Record<string, unknown>;

export class UserApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'UserApiError';
    this.status = status;
    this.code = code;
  }
}

function unwrapResponse<T>(response: ApiResponse<T> | undefined): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data as T;
    if ('items' in response && response.items !== undefined) return response.items as T;
    if ('results' in response && response.results !== undefined) return response.results as T;
  }
  return response as T;
}

function getString(record: LooseRecord | undefined, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getStringOrNull(record: LooseRecord | undefined, keys: string[]): string | null {
  const value = getString(record, keys);
  return value ? value : null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as LooseRecord;
  if (typeof record.message === 'string') return record.message;
  if (record.error && typeof record.error === 'object') {
    const error = record.error as LooseRecord;
    if (typeof error.message === 'string') return error.message;
  }
  return fallback;
}

function getErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as LooseRecord;
  if (typeof record.code === 'string') return record.code;
  if (record.error && typeof record.error === 'object') {
    const error = record.error as LooseRecord;
    if (typeof error.code === 'string') return error.code;
  }
  return undefined;
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
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
    throw new UserApiError(
      getErrorMessage(payload, `User request failed: ${response.status}`),
      response.status,
      getErrorCode(payload),
    );
  }

  return unwrapResponse(payload);
}

function mapRole(value: string | undefined): UserRole {
  const normalized = (value ?? '').toUpperCase();
  const roles: UserRole[] = [
    'OWNER',
    'ADMIN',
    'MANAGER',
    'FRONT_DESK',
    'HOUSEKEEPING',
    'MAINTENANCE',
    'ACCOUNTS',
    'READ_ONLY',
  ];
  return roles.find((role) => role === normalized) ?? 'READ_ONLY';
}

function mapStatus(value: string | undefined): UserStatus {
  return (value ?? '').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
}

function mapUser(dto: LooseRecord): PlatformUser {
  return {
    id: getString(dto, ['id', '_id', 'uuid']),
    propertyId: getStringOrNull(dto, ['propertyId', 'property_id']),
    name: getString(dto, ['name', 'displayName', 'fullName']),
    email: getString(dto, ['email']),
    role: mapRole(getString(dto, ['role'])),
    status: mapStatus(getString(dto, ['status'])),
    lastLoginAt: getStringOrNull(dto, ['lastLoginAt', 'last_login_at']),
    createdAt: getString(dto, ['createdAt', 'created_at']),
    updatedAt: getString(dto, ['updatedAt', 'updated_at']),
  };
}

export function getUsers(propertyId: string, signal?: AbortSignal): Promise<PlatformUser[]> {
  return request<LooseRecord[]>(`/properties/${propertyId}/users`, { signal }).then((users) =>
    users.map(mapUser),
  );
}

export function getUser(
  propertyId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<PlatformUser> {
  return request<LooseRecord>(`/properties/${propertyId}/users/${userId}`, { signal }).then(
    mapUser,
  );
}

export function createUser(
  propertyId: string,
  payload: CreateUserPayload,
): Promise<PlatformUser> {
  return request<LooseRecord>(`/properties/${propertyId}/users`, {
    body: JSON.stringify(cleanPayload(payload)),
    method: 'POST',
  }).then(mapUser);
}

export function updateUser(
  propertyId: string,
  userId: string,
  payload: UpdateUserPayload,
): Promise<PlatformUser> {
  return request<LooseRecord>(`/properties/${propertyId}/users/${userId}`, {
    body: JSON.stringify(cleanPayload(payload as Record<string, unknown>)),
    method: 'PATCH',
  }).then(mapUser);
}

export function resetUserPassword(
  propertyId: string,
  userId: string,
  password: string,
): Promise<PlatformUser> {
  return updateUser(propertyId, userId, { password });
}

export function friendlyUserError(error: unknown): string {
  if (error instanceof UserApiError) {
    if (error.code === 'FORBIDDEN' || error.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (error.status === 409) {
      return 'A user with this email already exists.';
    }
    if (error.code === 'VALIDATION_ERROR' || error.status === 400) {
      return error.message || 'The information provided is invalid.';
    }
  }
  return 'Unable to save user. Please try again.';
}
