'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../features/auth/auth-context';
import { getProperties, getPropertyReservations, type ReservationDto } from './reservation-api';
import { getPropertyGuests, type GuestDto } from './guest-api';
import { getPropertyRooms, type InventoryRoomDto } from './inventory-api';

export type FrontDeskTone = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'neutral';
export type FrontDeskTaskPriority = 'critical' | 'high' | 'medium';

export type FrontDeskSummary = {
  arrivalsToday: number;
  departuresToday: number;
  guestsInHouse: number;
  roomsToClean: number;
};

export type FrontDeskTask = {
  id: string;
  priority: FrontDeskTaskPriority;
  category: 'Arrival' | 'Room Ready' | 'VIP' | 'Maintenance' | 'ID Verification' | 'Checkout';
  title: string;
  subtitle: string;
  message: string;
  signal: string;
  action: string;
  tone: FrontDeskTone;
  href: string;
};

export type FrontDeskState = {
  error?: string;
  isLoading: boolean;
  propertyId?: string;
  summary: FrontDeskSummary;
  tasks: FrontDeskTask[];
};

type ReservationView = {
  backendId: string;
  id: string;
  arrivalDate: string;
  departureDate: string;
  guestName: string;
  isVip: boolean;
  roomAssigned: boolean;
  roomLabel: string;
  status: string;
};

type RoomView = {
  id: string;
  number: string;
  status: string;
};

type LoadResult<T> = {
  data: T;
  error?: string;
};

const emptySummary: FrontDeskSummary = {
  arrivalsToday: 0,
  departuresToday: 0,
  guestsInHouse: 0,
  roomsToClean: 0,
};

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function getBoolean(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return false;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1', 'vip'].includes(value.toLowerCase());
  }

  return false;
}

function getRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return undefined;
}

function getId(record: Record<string, unknown>) {
  return getString(record, ['id', '_id', 'uuid']);
}

function isActiveProperty(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function zonedDateKey(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const lookup: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function todayKey(timeZone: string) {
  return zonedDateKey(new Date(), timeZone);
}

function normalizeDate(value: string, timeZone: string) {
  if (!value) return '';

  // Reservation stay dates are date-only domain values. Preserve them exactly
  // instead of letting the browser timezone shift YYYY-MM-DD through Date parsing.
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (dateOnlyMatch) return dateOnlyMatch[0];

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return zonedDateKey(parsed, timeZone);

  return value.slice(0, 10);
}

function normalizeStatus(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, '_');
}

function isArrivalStatus(status: string) {
  const normalized = normalizeStatus(status);
  return !['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'CANCELED', 'NO_SHOW'].includes(normalized);
}

function isInHouseStatus(status: string) {
  return normalizeStatus(status) === 'CHECKED_IN';
}

function guestName(guest: GuestDto | undefined) {
  if (!guest) return 'Guest not connected';
  return (
    getString(guest, ['name', 'fullName', 'displayName', 'guestName']) ||
    [getString(guest, ['firstName']), getString(guest, ['lastName'])].filter(Boolean).join(' ') ||
    'Guest not connected'
  );
}

function createLookup<T extends Record<string, unknown>>(items: T[]) {
  return new Map(items.map((item) => [getId(item), item] as const).filter(([id]) => id));
}

function mapReservation(
  dto: ReservationDto,
  guests: Map<string, GuestDto>,
  timeZone: string,
): ReservationView {
  const guestRecord =
    getRecord(dto, ['guest', 'guestProfile']) ?? guests.get(getString(dto, ['guestId']));
  const roomRecord = getRecord(dto, ['room']);
  const roomNumber = getString(roomRecord, ['roomNumber', 'number', 'displayName']);
  const roomId = getString(dto, ['roomId'], getId(roomRecord ?? {}));
  const arrivalDate = normalizeDate(
    getString(dto, ['arrivalDate', 'checkInDate', 'startDate']),
    timeZone,
  );
  const departureDate = normalizeDate(
    getString(dto, ['departureDate', 'checkOutDate', 'endDate']),
    timeZone,
  );
  return {
    backendId: getString(dto, ['id', '_id', 'uuid']),
    id: getString(dto, ['reservationCode', 'code', 'bookingCode', 'id', '_id'], 'Reservation'),
    arrivalDate,
    departureDate,
    guestName: guestName(guestRecord),
    isVip:
      getBoolean(dto, ['isVip', 'vip']) || getBoolean(guestRecord, ['isVip', 'vip', 'vipStatus']),
    roomAssigned: Boolean(roomNumber || roomId),
    roomLabel: roomNumber ? `Room ${roomNumber}` : 'Room not assigned',
    status: getString(dto, ['status'], 'CONFIRMED'),
  };
}

function mapRoom(dto: InventoryRoomDto): RoomView {
  return {
    id: getId(dto),
    number: getString(dto, ['roomNumber', 'number', 'displayName'], 'Room'),
    status: normalizeStatus(
      getString(dto, ['operationalStatus', 'operational_status', 'status'], 'READY'),
    ),
  };
}

function isRoomCleaning(status: string) {
  return [
    'DIRTY',
    'NEEDS_CLEANING',
    'CLEANING',
    'CHECKOUT_DIRTY',
    'WAITING_GUEST',
    'INSPECTION',
  ].includes(status);
}

function isRoomReady(status: string) {
  return ['READY', 'AVAILABLE', 'CLEAN', 'VACANT_READY', 'ACTIVE'].includes(status);
}

function isRoomOccupied(status: string) {
  return ['OCCUPIED', 'IN_HOUSE', 'GUEST_STAYING'].includes(status);
}

function isRoomMaintenance(status: string) {
  return ['MAINTENANCE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'BLOCKED', 'REPAIR'].includes(status);
}

function buildSummary(
  reservations: ReservationView[],
  rooms: RoomView[],
  timeZone: string,
): FrontDeskSummary {
  const today = todayKey(timeZone);
  const reservationGuestsInHouse = reservations.filter((reservation) =>
    isInHouseStatus(reservation.status),
  ).length;
  const occupiedRooms = rooms.filter((room) => isRoomOccupied(room.status)).length;

  return {
    arrivalsToday: reservations.filter(
      (reservation) => reservation.arrivalDate === today && isArrivalStatus(reservation.status),
    ).length,
    departuresToday: reservations.filter(
      (reservation) => reservation.departureDate === today && isInHouseStatus(reservation.status),
    ).length,
    guestsInHouse: Math.max(reservationGuestsInHouse, occupiedRooms),
    roomsToClean: rooms.filter((room) => isRoomCleaning(room.status)).length,
  };
}

function minutesUntil(dateKeyValue: string, timeZone: string) {
  if (dateKeyValue !== todayKey(timeZone)) return undefined;
  return 18;
}

function buildTasks(
  reservations: ReservationView[],
  rooms: RoomView[],
  timeZone: string,
): FrontDeskTask[] {
  const today = todayKey(timeZone);
  const tasks: FrontDeskTask[] = [];

  reservations.forEach((reservation) => {
    const isArrivalToday = reservation.arrivalDate === today && isArrivalStatus(reservation.status);
    const urgency = minutesUntil(reservation.arrivalDate, timeZone);

    if (isArrivalToday && !reservation.roomAssigned) {
      tasks.push({
        id: `arrival-room-${reservation.id}`,
        priority: 'critical',
        category: 'Arrival',
        title: reservation.guestName,
        subtitle: `${reservation.id} - ${reservation.roomLabel}`,
        message: 'Room is not assigned for today arrival.',
        signal: urgency ? `Arrival in ${urgency} min` : 'Arriving today',
        action: 'Assign Room',
        tone: 'red',
        href: `/rooms?mode=assign&status=ready&reservationId=${encodeURIComponent(reservation.backendId)}`,
      });
    }

    if (isArrivalToday && reservation.isVip) {
      tasks.push({
        id: `vip-${reservation.id}`,
        priority: 'medium',
        category: 'VIP',
        title: reservation.guestName,
        subtitle: `${reservation.id} - ${reservation.roomLabel}`,
        message: 'VIP arrival needs welcome preparation.',
        signal: 'VIP arrival',
        action: 'Prepare Welcome',
        tone: 'purple',
        href: '/guests',
      });
    }
  });

  rooms
    .filter((room) => isRoomReady(room.status))
    .slice(0, 2)
    .forEach((room) => {
      tasks.push({
        id: `room-ready-${room.id || room.number}`,
        priority: 'medium',
        category: 'Room Ready',
        title: `Room ${room.number}`,
        subtitle: 'Cleaned and ready',
        message: 'Available to assign to a waiting or upcoming guest.',
        signal: 'Ready now',
        action: 'Assign Guest',
        tone: 'green',
        href: '/rooms',
      });
    });

  rooms
    .filter((room) => isRoomMaintenance(room.status))
    .slice(0, 2)
    .forEach((room) => {
      tasks.push({
        id: `maintenance-${room.id || room.number}`,
        priority: 'high',
        category: 'Maintenance',
        title: `Room ${room.number}`,
        subtitle: 'Unavailable room',
        message: 'Room requires engineering or operational review.',
        signal: 'Maintenance',
        action: 'View Room',
        tone: 'red',
        href: '/rooms',
      });
    });

  const priorityOrder: Record<FrontDeskTaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };

  return tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 20);
}

async function getCurrentProperty(
  signal?: AbortSignal,
  preferredPropertyId?: string,
): Promise<{ propertyId: string; timeZone: string }> {
  const properties = await getProperties(signal);
  const property =
    (preferredPropertyId
      ? properties.find((item) => getId(item) === preferredPropertyId)
      : undefined) ?? properties.find((item) => isActiveProperty(item));

  const propertyId = property ? getId(property) : '';
  const timeZone = property ? getString(property, ['timezone'], 'UTC') : 'UTC';

  if (!property || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return { propertyId, timeZone };
}

async function loadFrontDesk(
  signal?: AbortSignal,
  preferredPropertyId?: string,
): Promise<Omit<FrontDeskState, 'isLoading' | 'error'> & { error?: string }> {
  const { propertyId, timeZone } = await getCurrentProperty(signal, preferredPropertyId);
  const [reservationResult, roomResult, guestResult] = await Promise.all([
    getPropertyReservations(propertyId, signal).then(
      (reservations): LoadResult<ReservationDto[]> => ({ data: reservations }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;

        return {
          data: [] as ReservationDto[],
          error: errorMessage(error, 'Reservation data is temporarily unavailable.'),
        };
      },
    ),
    getPropertyRooms(propertyId, signal).then(
      (rooms): LoadResult<InventoryRoomDto[]> => ({ data: rooms }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;

        return {
          data: [] as InventoryRoomDto[],
          error: errorMessage(error, 'Room data is temporarily unavailable.'),
        };
      },
    ),
    getPropertyGuests(propertyId, signal).then(
      (guests): LoadResult<GuestDto[]> => ({ data: guests }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;

        return {
          data: [] as GuestDto[],
          error: errorMessage(error, 'Guest data is temporarily unavailable.'),
        };
      },
    ),
  ]);
  const guests = createLookup(guestResult.data);
  const reservations = reservationResult.data.map((reservation) =>
    mapReservation(reservation, guests, timeZone),
  );
  const rooms = roomResult.data.map(mapRoom);
  const dataErrors = [reservationResult.error, roomResult.error, guestResult.error].filter(Boolean);

  return {
    error: dataErrors.length > 0 ? dataErrors.join(' ') : undefined,
    propertyId,
    summary: buildSummary(reservations, rooms, timeZone),
    tasks: buildTasks(reservations, rooms, timeZone),
  };
}

export function useFrontDeskData(): FrontDeskState & { refreshFrontDesk: () => Promise<void> } {
  const auth = useAuth();
  const [state, setState] = useState<FrontDeskState>({
    isLoading: true,
    summary: emptySummary,
    tasks: [],
  });

  const refreshFrontDesk = useCallback(
    async (signal?: AbortSignal) => {
      setState((current) => ({
        ...current,
        error: undefined,
        isLoading: current.tasks.length === 0,
      }));

      try {
        const data = await loadFrontDesk(signal, auth.user?.propertyId);
        setState({ ...data, isLoading: false });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Front Desk dashboard API failed', error);
        setState((current) => ({
          ...current,
          error:
            error instanceof Error ? error.message : 'Front Desk data is temporarily unavailable.',
          isLoading: false,
        }));
      }
    },
    [auth.user?.propertyId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refreshFrontDesk(controller.signal);
    return () => controller.abort();
  }, [refreshFrontDesk]);

  return { ...state, refreshFrontDesk };
}
