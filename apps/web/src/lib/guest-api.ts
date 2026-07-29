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
    | ApiResponse<T>
    | { message?: unknown }
    | undefined;

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
  blacklistStatus?: boolean;
  displayName?: string;
  email?: string;
  firstName: string;
  lastName: string;
  nationality?: string;
  phone: string;
  preferredLanguage?: string;
  status?: string;
  vipStatus?: boolean;
};

export function getProperties(signal?: AbortSignal) {
  return request<GuestPropertyDto[]>('/properties', { signal });
}

export function getPropertyGuests(propertyId: string, signal?: AbortSignal) {
  return request<GuestDto[]>(`/properties/${propertyId}/guests`, { signal });
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
