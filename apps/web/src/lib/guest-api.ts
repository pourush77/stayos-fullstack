export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Guest API request failed: ${response.status} ${response.statusText}`);
  }

  return unwrapResponse<T>((await response.json()) as ApiResponse<T>);
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

export function getProperties(signal?: AbortSignal) {
  return get<GuestPropertyDto[]>('/properties', signal);
}

export function getPropertyGuests(propertyId: string, signal?: AbortSignal) {
  return get<GuestDto[]>(`/properties/${propertyId}/guests`, signal);
}

export function getPropertyGuest(propertyId: string, guestId: string, signal?: AbortSignal) {
  return get<GuestDto>(`/properties/${propertyId}/guests/${guestId}`, signal);
}
