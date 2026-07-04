import { API_BASE_URL } from './inventory-api';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    throw new Error(`Operations API request failed: ${response.status} ${response.statusText}`);
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

export type OperationsUiStatus = 'READY' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'UNAVAILABLE';

export type OperationsAttentionLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export type OperationsRoomBoardItemDto = {
  roomId: string;
  roomNumber: string;
  floor: {
    id: string;
    name?: string;
    code?: string;
    floorNumber?: number;
  };
  roomType: {
    id: string;
    code?: string;
    name: string;
  };
  uiStatus: OperationsUiStatus;
  operationalStatus: string;
  currentStay?: {
    reservationId: string;
    reservationCode: string;
    guestId: string;
    guestName: string;
    arrivalDate: string;
    departureDate: string;
    checkInTime?: string;
    checkedInAt?: string;
    checkOutTime?: string;
    checkedOutAt?: string;
    adults?: number;
    children?: number;
    guestCount?: number;
    specialRequests?: string[];
    status: string;
    paymentStatus?: string;
  } | null;
  checkoutLabel?: string | null;
  primaryAction: string;
  attentionLevel: OperationsAttentionLevel;
};

export type OperationsRoomDetailsDto = Record<string, unknown>;

export type OperationsAvailableRoomDto = OperationsRoomBoardItemDto;

export type OperationsAttentionItemDto = {
  type: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  relatedEntity?: {
    type: string;
    id: string;
  };
  primaryAction: string;
};

export type OperationsActivityItemDto = {
  title: string;
  description: string;
  timestamp: string;
  entity?: {
    type: string;
    id: string;
  };
  metadata?: Record<string, unknown>;
};

export function getRoomBoard(propertyId: string, signal?: AbortSignal) {
  return get<OperationsRoomBoardItemDto[]>(
    `/properties/${propertyId}/operations/room-board`,
    signal,
  );
}

export function getRoomDetails(propertyId: string, roomId: string, signal?: AbortSignal) {
  return get<OperationsRoomDetailsDto>(
    `/properties/${propertyId}/operations/rooms/${roomId}`,
    signal,
  );
}

export function getAvailableRooms(
  propertyId: string,
  params: {
    arrivalDate?: string;
    departureDate?: string;
    roomTypeId?: string;
    guestCount?: number;
    accessible?: boolean;
    connecting?: boolean;
    vipPreferred?: boolean;
  } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return get<OperationsAvailableRoomDto[]>(
    `/properties/${propertyId}/operations/available-rooms${suffix}`,
    signal,
  );
}

export function getNeedsAttention(propertyId: string, signal?: AbortSignal) {
  return get<OperationsAttentionItemDto[]>(
    `/properties/${propertyId}/operations/needs-attention`,
    signal,
  );
}

export function getActivityFeed(
  propertyId: string,
  params: {
    entityType?: string;
    entityId?: string;
    type?: string;
    limit?: number;
  } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return get<OperationsActivityItemDto[]>(`/properties/${propertyId}/activity${suffix}`, signal);
}
