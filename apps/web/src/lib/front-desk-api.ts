'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../features/auth/auth-context';
import { getProperties, getPropertyReservations, type ReservationDto } from './reservation-api';
import { getPropertyGuests, type GuestDto } from './guest-api';
import { getPropertyRooms, type InventoryRoomDto } from './inventory-api';
import { getNeedsAttention, type OperationsAttentionItemDto } from './operations-api';

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
  roomText?: string;
  bookingCode?: string;
  message: string;
  signal: string;
  eyebrow?: string;
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
  roomId?: string;
  roomNumber?: string;
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

function guestName(guestRecord: Record<string, unknown> | GuestDto | undefined) {
  if (!guestRecord) return 'Guest not connected';
  return (
    getString(guestRecord as Record<string, unknown>, ['displayName', 'name', 'fullName', 'guestName']) ||
    [
      getString(guestRecord as Record<string, unknown>, ['firstName']),
      getString(guestRecord as Record<string, unknown>, ['lastName']),
    ]
      .filter(Boolean)
      .join(' ') ||
    'Guest not connected'
  );
}

function createLookup<T extends { id?: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = getId(item);
    if (id) map.set(id, item);
  }
  return map;
}

function mapReservation(
  dto: ReservationDto,
  guests: Map<string, GuestDto>,
  rooms: Map<string, RoomView>,
  timeZone: string,
): ReservationView {
  const guestRecord =
    getRecord(dto, ['guest', 'guestProfile']) ?? guests.get(getString(dto, ['guestId']));
  const roomRecord = getRecord(dto, ['room']);
  const roomId = getString(dto, ['roomId'], getId(roomRecord ?? {}));
  const roomFromMap = roomId ? rooms.get(roomId) : undefined;
  const roomNumber =
    getString(dto, ['roomNumber']) ||
    getString(roomRecord, ['roomNumber', 'number', 'displayName']) ||
    roomFromMap?.number ||
    '';
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
    roomId: roomId || undefined,
    roomNumber: roomNumber || undefined,
    roomAssigned: Boolean(roomNumber || roomId),
    roomLabel: roomNumber ? `Room ${roomNumber}` : 'Unassigned',
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
      const roomText = 'Unassigned';
      const bookingCode = reservation.id;
      tasks.push({
        id: `arrival-room-${reservation.id}`,
        priority: 'high',
        category: 'Arrival',
        title: reservation.guestName,
        roomText,
        bookingCode,
        subtitle: `${roomText} · ${bookingCode}`,
        message: 'Arrives today without an assigned room.',
        signal: urgency ? `Arrival in ${urgency} min` : 'Arriving today',
        eyebrow: 'ACTION NEEDED',
        action: 'Assign Room',
        tone: 'red',
        href: `/rooms?mode=assign&status=ready&reservationId=${encodeURIComponent(reservation.backendId)}`,
      });
    }

    if (isArrivalToday && reservation.isVip) {
      const roomText = reservation.roomNumber ? `Room ${reservation.roomNumber}` : 'Unassigned';
      const bookingCode = reservation.id;
      tasks.push({
        id: `vip-${reservation.id}`,
        priority: 'critical',
        category: 'VIP',
        title: reservation.guestName,
        roomText,
        bookingCode,
        subtitle: `${roomText} · ${bookingCode}`,
        message: 'VIP arrival needs welcome preparation.',
        signal: 'VIP arrival',
        eyebrow: 'VIP ARRIVAL',
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
      const roomText = `Room ${room.number}`;
      tasks.push({
        id: `room-ready-${room.id || room.number}`,
        priority: 'medium',
        category: 'Room Ready',
        title: `Room ${room.number}`,
        roomText,
        subtitle: roomText,
        message: 'Cleaned, inspected, and ready for check-in.',
        signal: 'Ready now',
        eyebrow: 'ROOM READY',
        action: 'Assign Guest',
        tone: 'green',
        href: '/rooms',
      });
    });

  rooms
    .filter((room) => isRoomMaintenance(room.status))
    .slice(0, 2)
    .forEach((room) => {
      const roomText = `Room ${room.number}`;
      tasks.push({
        id: `maintenance-${room.id || room.number}`,
        priority: 'high',
        category: 'Maintenance',
        title: `Room ${room.number}`,
        roomText,
        subtitle: roomText,
        message: 'Requires engineering or maintenance review.',
        signal: 'Maintenance',
        eyebrow: 'MAINTENANCE',
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

function mapAttentionItemToTask(
  item: OperationsAttentionItemDto,
  reservationsMap: Map<string, ReservationView>,
  roomsMap: Map<string, RoomView>,
): FrontDeskTask {
  const isCheckout =
    item.category === 'Checkout' ||
    item.type.includes('CHECKOUT') ||
    item.type === 'DEPARTURE_TODAY';
  const isArrival = item.type.includes('ARRIVAL') || item.category === 'Arrival';
  const isVip = item.category === 'VIP' || item.type.includes('VIP');
  const isRoom = item.type.startsWith('ROOM_') || item.relatedEntity?.type === 'Room';

  let category: FrontDeskTask['category'] = 'Arrival';
  if (isCheckout) category = 'Checkout';
  else if (isVip) category = 'VIP';
  else if (isArrival) category = 'Arrival';
  else if (isRoom) {
    category =
      item.type === 'ROOM_MAINTENANCE' || item.type === 'ROOM_OUT_OF_ORDER'
        ? 'Maintenance'
        : 'Room Ready';
  }

  const priority: FrontDeskTaskPriority =
    item.priority === 'CRITICAL'
      ? 'critical'
      : item.priority === 'HIGH'
        ? 'high'
        : 'medium';

  let tone: FrontDeskTone = 'neutral';
  if (priority === 'critical') tone = 'red';
  else if (priority === 'high') tone = category === 'Checkout' ? 'amber' : 'red';
  else if (category === 'VIP') tone = 'purple';
  else if (category === 'Room Ready') tone = 'green';
  else tone = 'blue';

  let href = '/';
  if (item.relatedEntity?.type === 'Reservation') {
    if (isArrival) {
      href = `/rooms?mode=assign&status=ready&reservationId=${encodeURIComponent(item.relatedEntity.id)}`;
    } else {
      href = `/reservations/${encodeURIComponent(item.relatedEntity.id)}`;
    }
  } else if (item.relatedEntity?.type === 'Room') {
    href = `/rooms?roomId=${encodeURIComponent(item.relatedEntity.id)}`;
  }

  let roomNumber: string | undefined = undefined;
  let bookingCode: string | undefined = undefined;
  let title = item.title;

  if (item.relatedEntity?.type === 'Reservation') {
    const res = reservationsMap.get(item.relatedEntity.id);
    if (item.metadata?.roomNumber) {
      roomNumber = String(item.metadata.roomNumber);
    } else if (res?.roomNumber) {
      roomNumber = res.roomNumber;
    } else if (res?.roomId) {
      const roomEntity = roomsMap.get(res.roomId);
      if (roomEntity?.number) {
        roomNumber = roomEntity.number;
      }
    }

    if (item.metadata?.reservationCode) {
      bookingCode = String(item.metadata.reservationCode);
    } else if (res?.id) {
      bookingCode = res.id;
    }

    if (item.metadata?.guestName && item.metadata.guestName !== 'Guest') {
      title = String(item.metadata.guestName);
    } else if (res?.guestName && res.guestName !== 'Guest not connected') {
      title = res.guestName;
    }
  } else if (item.relatedEntity?.type === 'Room') {
    const rm = roomsMap.get(item.relatedEntity.id);
    roomNumber = rm?.number || (item.metadata?.roomNumber ? String(item.metadata.roomNumber) : undefined);
    if (!title || title === 'View Room' || title === 'View Progress') {
      title = roomNumber ? `Room ${roomNumber}` : 'Room';
    }
  }

  const roomText = roomNumber
    ? `Room ${roomNumber}`
    : isRoom
      ? title.startsWith('Room')
        ? title
        : `Room ${title}`
      : 'Unassigned';
  const subtitle = `${roomText}${bookingCode ? ` · ${bookingCode}` : ''}`;

  let eyebrow = 'ACTION REQUIRED';
  if (priority === 'critical') {
    if (category === 'Checkout') eyebrow = 'OVERDUE CHECKOUT';
    else if (category === 'VIP') eyebrow = 'VIP ARRIVAL';
    else if (item.type === 'ROOM_OUT_OF_ORDER') eyebrow = 'OUT OF ORDER';
    else eyebrow = 'CRITICAL ATTENTION';
  } else if (priority === 'high') {
    if (item.type.includes('DUE_NOW')) eyebrow = 'CHECKOUT DUE NOW';
    else if (item.type.includes('DUE_SOON')) eyebrow = 'CHECKOUT DUE SOON';
    else if (category === 'Arrival') eyebrow = 'ACTION NEEDED';
    else if (category === 'Maintenance') eyebrow = 'MAINTENANCE';
    else if (item.type === 'PENDING_PAYMENT') eyebrow = 'PAYMENT DUE';
    else eyebrow = 'HIGH PRIORITY';
  } else {
    if (item.type === 'LATE_CHECKOUT_APPROVED') eyebrow = 'LATE CHECKOUT';
    else if (category === 'Checkout') eyebrow = 'DEPARTING TODAY';
    else if (category === 'Room Ready') eyebrow = 'ROOM READY';
    else eyebrow = 'SCHEDULED';
  }

  return {
    id: `attention-${item.type}-${item.relatedEntity?.id ?? item.title}`,
    priority,
    category,
    title,
    roomText,
    bookingCode,
    subtitle,
    message: item.description,
    signal: item.signal || (priority === 'critical' ? 'Urgent' : 'Action needed'),
    eyebrow,
    action: item.primaryAction,
    tone,
    href,
  };
}

async function loadFrontDesk(
  signal?: AbortSignal,
  preferredPropertyId?: string,
): Promise<Omit<FrontDeskState, 'isLoading' | 'error'> & { error?: string }> {
  const { propertyId, timeZone } = await getCurrentProperty(signal, preferredPropertyId);
  const [reservationResult, roomResult, guestResult, attentionResult] = await Promise.all([
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
    getNeedsAttention(propertyId, signal).then(
      (attention): LoadResult<OperationsAttentionItemDto[]> => ({ data: attention }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;

        return {
          data: [] as OperationsAttentionItemDto[],
          error: errorMessage(error, 'Attention queue data is temporarily unavailable.'),
        };
      },
    ),
  ]);
  const guests = createLookup(guestResult.data);
  const rooms = roomResult.data.map(mapRoom);
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const reservations = reservationResult.data.map((reservation) =>
    mapReservation(reservation, guests, roomsById, timeZone),
  );
  const reservationsById = new Map(reservations.map((r) => [r.backendId, r]));

  const tasks =
    attentionResult.data.length > 0
      ? attentionResult.data.map((item) =>
          mapAttentionItemToTask(item, reservationsById, roomsById),
        )
      : buildTasks(reservations, rooms, timeZone);

  const dataErrors = [
    reservationResult.error,
    roomResult.error,
    guestResult.error,
    attentionResult.error,
  ].filter(Boolean);

  return {
    error: dataErrors.length > 0 ? dataErrors.join(' ') : undefined,
    propertyId,
    summary: buildSummary(reservations, rooms, timeZone),
    tasks,
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
