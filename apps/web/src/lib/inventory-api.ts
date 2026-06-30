export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Inventory API request failed: ${response.status} ${response.statusText}`);
  }

  return unwrapResponse<T>((await response.json()) as ApiResponse<T>);
}

async function patch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    method: 'PATCH',
    signal,
  });

  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | { message?: unknown; error?: unknown } | undefined;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Inventory API request failed: ${response.status} ${response.statusText}`;
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

export type InventoryPropertyDto = Record<string, unknown>;
export type InventoryFloorDto = Record<string, unknown>;
export type InventoryRoomTypeDto = Record<string, unknown>;
export type InventoryRoomDto = Record<string, unknown>;

export function getProperties(signal?: AbortSignal) {
  return get<InventoryPropertyDto[]>('/properties', signal);
}

export function getPropertyFloors(propertyId: string, signal?: AbortSignal) {
  return get<InventoryFloorDto[]>(`/properties/${propertyId}/floors`, signal);
}

export function getPropertyRoomTypes(propertyId: string, signal?: AbortSignal) {
  return get<InventoryRoomTypeDto[]>(`/properties/${propertyId}/room-types`, signal);
}

export function getPropertyRooms(propertyId: string, signal?: AbortSignal) {
  return get<InventoryRoomDto[]>(`/properties/${propertyId}/rooms`, signal);
}

export function markRoomReady(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/mark-ready`, signal);
}

export function markRoomCleaning(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/mark-cleaning`, signal);
}

export function markRoomInspection(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/mark-inspection`, signal);
}

export function blockRoom(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/block`, signal);
}

export function markRoomOutOfService(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/out-of-service`, signal);
}

export function markRoomOutOfOrder(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/out-of-order`, signal);
}

export function markRoomMaintenance(propertyId: string, roomId: string, signal?: AbortSignal) {
  return patch<InventoryRoomDto>(`/properties/${propertyId}/rooms/${roomId}/maintenance`, signal);
}
