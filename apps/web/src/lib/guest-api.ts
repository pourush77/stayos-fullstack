import { API_BASE_URL } from './api-base';

export { API_BASE_URL };

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => undefined)) as
    ApiResponse<T> | { message?: unknown } | undefined;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Guest API request failed: ${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  return unwrapResponse<T>(payload as ApiResponse<T>);
}

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }

  return response as T;
}

export type GuestPropertyDto = Record<string, unknown>;
export type GuestDto = Record<string, unknown>;

export type GuestPayloadDto = {
  alternatePhone?: string;
  bedPreference?: string;
  blacklistStatus?: boolean;
  dietaryNotes?: string;
  displayName?: string;
  email?: string;
  firstName: string;
  floorPreference?: string;
  lastName: string;
  nationality?: string;
  notes?: string;
  phone: string;
  preferredLanguage?: string;
  roomPreference?: string;
  smokingPreference?: string;
  status?: string;
  vipStatus?: boolean;
};

export type PropertyPolicyType =
  | 'INDIVIDUAL_DEPOSIT'
  | 'GROUP_DEPOSIT'
  | 'CANCELLATION'
  | 'NO_SHOW'
  | 'EARLY_CHECK_IN'
  | 'LATE_CHECKOUT';

export type DepositPolicyMode = 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';

export type PolicyChargeMode = 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIRST_NIGHT';

export type PropertyPolicyDto = {
  id: string;
  propertyId: string;
  ratePlanId: string | null;
  policyType: PropertyPolicyType;
  isActive: boolean;
  depositMode: DepositPolicyMode | null;
  depositValue: number | null;
  chargeMode: PolicyChargeMode | null;
  chargeValue: number | null;
  cancellationCutoffHours: number | null;
  graceMinutes: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertPropertyPolicyPayload = {
  isActive?: boolean;
  ratePlanId?: string;
  depositMode?: DepositPolicyMode;
  depositValue?: number;
  chargeMode?: PolicyChargeMode;
  chargeValue?: number;
  cancellationCutoffHours?: number;
  graceMinutes?: number;
};

export function getProperties(signal?: AbortSignal) {
  return request<GuestPropertyDto[]>('/properties', { signal });
}

export function updateProperty(
  propertyId: string,
  payload: Partial<GuestPropertyDto>,
  signal?: AbortSignal,
) {
  return request<GuestPropertyDto>(`/properties/${propertyId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
    signal,
  });
}

export function getPropertyPolicies(propertyId: string, signal?: AbortSignal) {
  return request<PropertyPolicyDto[]>(`/properties/${propertyId}/policies`, {
    signal,
  });
}

export function getPropertyPolicy(
  propertyId: string,
  policyType: PropertyPolicyType,
  signal?: AbortSignal,
) {
  return request<PropertyPolicyDto | null>(`/properties/${propertyId}/policies/${policyType}`, {
    signal,
  });
}

export function upsertPropertyPolicy(
  propertyId: string,
  policyType: PropertyPolicyType,
  payload: UpsertPropertyPolicyPayload,
  signal?: AbortSignal,
) {
  return request<PropertyPolicyDto>(`/properties/${propertyId}/policies/${policyType}`, {
    body: JSON.stringify(payload),
    method: 'PUT',
    signal,
  });
}

export function getPropertyGuests(propertyId: string, signal?: AbortSignal, search?: string) {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';

  return request<GuestDto[]>(`/properties/${propertyId}/guests${query}`, {
    signal,
  });
}

export function getPropertyGuest(propertyId: string, guestId: string, signal?: AbortSignal) {
  return request<GuestDto>(`/properties/${propertyId}/guests/${guestId}`, { signal });
}

export function createPropertyGuest(
  propertyId: string,
  payload: GuestPayloadDto,
  signal?: AbortSignal,
) {
  return request<GuestDto>(`/properties/${propertyId}/guests`, {
    body: JSON.stringify(payload),
    method: 'POST',
    signal,
  });
}

export function updatePropertyGuest(
  propertyId: string,
  guestId: string,
  payload: Partial<GuestPayloadDto>,
  signal?: AbortSignal,
) {
  return request<GuestDto>(`/properties/${propertyId}/guests/${guestId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
    signal,
  });
}
