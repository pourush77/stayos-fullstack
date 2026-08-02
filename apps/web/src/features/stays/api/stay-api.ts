import { getPropertyGuest, type GuestDto } from '../../../lib/guest-api';
import { getPropertyRooms, type InventoryRoomDto } from '../../../lib/inventory-api';
import {
  getActivityFeed,
  getRoomBoard,
  type OperationsActivityItemDto,
  type OperationsRoomBoardItemDto,
} from '../../../lib/operations-api';
import { API_BASE_URL, type ReservationDto } from '../../../lib/reservation-api';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

export type StayReadModelDto = {
  activity?: OperationsActivityItemDto[];
  allowedActions?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  guest?: GuestDto;
  payment?: Record<string, unknown>;
  reservation?: ReservationDto;
  room?: InventoryRoomDto | OperationsRoomBoardItemDto;
  warnings?: Record<string, unknown>[];
};

export type StayWorkspaceDto = {
  activity: OperationsActivityItemDto[];
  allowedActions?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  guest?: GuestDto;
  payment?: Record<string, unknown>;
  reservation: ReservationDto;
  room?: InventoryRoomDto | OperationsRoomBoardItemDto;
  warnings?: Record<string, unknown>[];
};

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }

  return response as T;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });

  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    throw new Error(`Stay API request failed: ${response.status} ${response.statusText}`);
  }

  return unwrapResponse<T>(payload as ApiResponse<T>);
}

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getRecord(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return undefined;
}

function findAssignedRoom(
  reservation: ReservationDto,
  rooms: InventoryRoomDto[],
  board: OperationsRoomBoardItemDto[],
) {
  const roomId = getString(reservation, ['roomId'], getString(getRecord(reservation, ['room']), ['id', '_id', 'uuid']));
  const reservationId = getString(reservation, ['id', '_id', 'uuid']);
  const bookingCode = getString(reservation, ['reservationCode', 'bookingCode', 'code']);

  return (
    board.find(
      (room) =>
        room.roomId === roomId ||
        room.currentStay?.reservationId === reservationId ||
        room.currentStay?.reservationCode === bookingCode,
    ) ??
    rooms.find((room) => getString(room, ['id', '_id', 'uuid']) === roomId) ??
    getRecord(reservation, ['room'])
  );
}

export async function getStayWorkspace(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
): Promise<StayWorkspaceDto> {
  try {
    const readModel = await get<StayReadModelDto>(
      `/properties/${propertyId}/stays/${reservationId}`,
      signal,
    );

    if (readModel.reservation) {
      return {
        activity: readModel.activity ?? [],
        allowedActions: readModel.allowedActions,
        documents: readModel.documents,
        guest: readModel.guest,
        payment: readModel.payment,
        reservation: readModel.reservation,
        room: readModel.room,
        warnings: readModel.warnings,
      };
    }
  } catch {
    // Read-model endpoint is optional. Fall back to existing source-of-truth endpoints.
  }

  const reservation = await get<ReservationDto>(
    `/properties/${propertyId}/reservations/${reservationId}`,
    signal,
  );
  const guestId = getString(reservation, ['guestId'], getString(getRecord(reservation, ['guest', 'guestProfile']), ['id', '_id', 'uuid']));

  const [guest, rooms, roomBoard, activity] = await Promise.all([
    guestId ? getPropertyGuest(propertyId, guestId, signal).catch(() => undefined) : Promise.resolve(undefined),
    getPropertyRooms(propertyId, signal).catch(() => []),
    getRoomBoard(propertyId, signal).catch(() => []),
    getActivityFeed(propertyId, { entityType: 'RESERVATION', entityId: reservationId, limit: 20 }, signal).catch(() => []),
  ]);

  return {
    activity,
    guest,
    reservation,
    room: findAssignedRoom(reservation, rooms, roomBoard),
  };
}
