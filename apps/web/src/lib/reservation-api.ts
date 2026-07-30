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
        : `Reservation API request failed: ${response.status} ${response.statusText}`;
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

export type ReservationPropertyDto = Record<string, unknown>;
export type ReservationDto = Record<string, unknown>;

export function getProperties(signal?: AbortSignal) {
  return request<ReservationPropertyDto[]>('/properties', { signal });
}

export function getPropertyReservations(propertyId: string, signal?: AbortSignal) {
  return request<ReservationDto[]>(`/properties/${propertyId}/reservations`, { signal });
}

export function getPropertyReservation(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations/${reservationId}`, {
    signal,
  });
}

export function createPropertyReservation(
  propertyId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations`, {
    body: JSON.stringify(payload),
    method: 'POST',
    signal,
  });
}

export function updatePropertyReservation(
  propertyId: string,
  reservationId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations/${reservationId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
    signal,
  });
}

export function cancelReservation(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
    signal,
  });
}

export type ReservationWorkflowResponseDto = {
  reservation: {
    id: string;
    reservationCode: string;
    status: string;
    roomId?: string | null;
  };
  room: {
    id: string;
    roomNumber: string;
    operationalStatus: string;
  };
};

export function assignRoomToReservation(
  propertyId: string,
  reservationId: string,
  roomId: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/assign-room`,
    {
      body: JSON.stringify({ roomId }),
      method: 'PATCH',
      signal,
    },
  );
}

export function unassignRoomFromReservation(
  propertyId: string,
  reservationId?: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/unassign-room`,
    {
      method: 'PATCH',
      signal,
    },
  );
}

export function checkInReservation(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in`,
    {
      method: 'PATCH',
      signal,
    },
  );
}

export function checkOutReservation(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-out`,
    {
      method: 'PATCH',
      signal,
    },
  );
}

export function extendReservationStay(
  propertyId: string,
  reservationId: string,
  departureDate: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/extend`,
    {
      body: JSON.stringify({ departureDate }),
      method: 'PATCH',
      signal,
    },
  );
}

export function moveReservationRoom(
  propertyId: string,
  reservationId: string,
  roomId: string,
  reason?: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/move-room`,
    {
      body: JSON.stringify({ roomId, reason }),
      method: 'PATCH',
      signal,
    },
  );
}
