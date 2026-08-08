import { API_BASE_URL } from '../../../lib/api-base';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

export type GuestRequestStatus =
  'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type GuestRequestPriority = 'NORMAL' | 'HIGH' | 'VIP';
export type GuestRequestDepartment =
  'HOUSEKEEPING' | 'MAINTENANCE' | 'LAUNDRY' | 'RECEPTION' | 'CONCIERGE' | 'F_AND_B';

export type GuestRequestType =
  | 'EXTRA_TOWELS'
  | 'EXTRA_PILLOW'
  | 'WATER_BOTTLES'
  | 'LAUNDRY_PICKUP'
  | 'WAKE_UP_CALL'
  | 'AIRPORT_PICKUP'
  | 'AIRPORT_DROP'
  | 'TAXI'
  | 'LUGGAGE_ASSISTANCE'
  | 'BABY_COT'
  | 'EXTRA_BED'
  | 'HAIR_DRYER'
  | 'IRON_BOARD'
  | 'ROOM_CLEANING'
  | 'AC_ISSUE'
  | 'TV_ISSUE'
  | 'WIFI_ISSUE'
  | 'SPECIAL_DECORATION'
  | 'FLOWERS'
  | 'CAKE'
  | 'OTHER';

export type GuestRequestDto = {
  id: string;
  propertyId: string;
  reservationId?: string | null;
  guestId?: string | null;
  roomId?: string | null;
  requestType?: GuestRequestType | null;
  details?: Record<string, unknown> | null;
  title: string;
  description?: string | null;
  status: GuestRequestStatus;
  priority: GuestRequestPriority;
  department: GuestRequestDepartment;
  overdue: boolean;
  guestDisplayName?: string | null;
  roomNumber?: string | null;
  reservationCode?: string | null;
  assignedEmployeeName?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GuestRequestSummaryDto = {
  active: number;
  awaitingAction: number;
  completedToday: number;
  highPriority: number;
  vip: number;
  overdue: number;
};

export type GuestRequestSuggestionDto = {
  type: GuestRequestType;
  title: string;
  department: GuestRequestDepartment;
};

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
  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;
  if (!response.ok) throw new Error(`Guest requests request failed: ${response.status}`);
  return unwrap<T>(payload as ApiResponse<T>);
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }
  return response as T;
}

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export function listGuestRequests(
  propertyId: string,
  params: { status?: string; department?: string; requestType?: string; search?: string },
) {
  return request<GuestRequestDto[]>(
    `/properties/${propertyId}/guest-requests${queryString(params)}`,
  );
}

export function getGuestRequestSummary(propertyId: string) {
  return request<GuestRequestSummaryDto>(`/properties/${propertyId}/guest-requests/summary`);
}

export function getGuestRequestSuggestions(propertyId: string) {
  return request<GuestRequestSuggestionDto[]>(
    `/properties/${propertyId}/guest-requests/suggestions`,
  );
}

export function createGuestRequest(propertyId: string, payload: Record<string, unknown>) {
  return request<GuestRequestDto>(`/properties/${propertyId}/guest-requests`, {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function transitionGuestRequest(
  propertyId: string,
  requestId: string,
  action: 'accept' | 'start' | 'complete' | 'cancel',
) {
  return request<GuestRequestDto>(
    `/properties/${propertyId}/guest-requests/${requestId}/${action}`,
    {
      method: 'PATCH',
    },
  );
}
