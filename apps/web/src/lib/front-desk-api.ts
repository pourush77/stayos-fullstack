'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getProperties,
  getPropertyReservations,
  type ReservationDto,
} from './reservation-api';
import { getPropertyGuests, type GuestDto } from './guest-api';
import { getPropertyRooms, type InventoryRoomDto } from './inventory-api';

export type FrontDeskTone = 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'neutral';
export type FrontDeskTaskPriority = 'critical' | 'high' | 'medium';

export type FrontDeskSummary = {
  arrivalsToday: number;
  departuresToday: number;
  guestsInHouse: number;
  paymentsDue: number;
  roomsToClean: number;
};

export type FrontDeskTask = {
  id: string;
  priority: FrontDeskTaskPriority;
  category:
    | 'Arrival'
    | 'Payment'
    | 'Room Ready'
    | 'VIP'
    | 'Maintenance'
    | 'ID Verification'
    | 'Checkout';
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
  id: string;
  arrivalDate: string;
  departureDate: string;
  balanceAmount: number;
  guestName: string;
  isVip: boolean;
  paymentStatus: string;
  roomAssigned: boolean;
  roomLabel: string;
  status: string;
};

type RoomView = {
  id: string;
  number: string;
  status: string;
};

const emptySummary: FrontDeskSummary = {
  arrivalsToday: 0,
  departuresToday: 0,
  guestsInHouse: 0,
  paymentsDue: 0,
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

function getNumber(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return 0;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
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

function todayKey() {
  return dateKey(new Date());
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function normalizeDate(value: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return dateKey(parsed);
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

function hasPaymentDue(status: string, balanceAmount: number) {
  const normalized = normalizeStatus(status);
  return balanceAmount > 0 || ['PAYMENT_DUE', 'DUE', 'PARTIALLY_PAID', 'PARTIAL', 'UNPAID'].includes(normalized);
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

function mapReservation(dto: ReservationDto, guests: Map<string, GuestDto>): ReservationView {
  const guestRecord = getRecord(dto, ['guest', 'guestProfile']) ?? guests.get(getString(dto, ['guestId']));
  const roomRecord = getRecord(dto, ['room']);
  const roomNumber = getString(roomRecord, ['roomNumber', 'number', 'displayName']);
  const roomId = getString(dto, ['roomId'], getId(roomRecord ?? {}));
  const arrivalDate = normalizeDate(getString(dto, ['arrivalDate', 'checkInDate', 'startDate']));
  const departureDate = normalizeDate(getString(dto, ['departureDate', 'checkOutDate', 'endDate']));
  const totalAmount = getNumber(dto, ['balanceAmount', 'balance', 'amountDue', 'dueAmount', 'outstandingAmount']);
  const paymentStatus = getString(dto, ['paymentStatus', 'payment_state', 'paymentState'], '');

  return {
    id: getString(dto, ['reservationCode', 'code', 'bookingCode', 'id', '_id'], 'Reservation'),
    arrivalDate,
    departureDate,
    balanceAmount: totalAmount,
    guestName: guestName(guestRecord),
    isVip: getBoolean(dto, ['isVip', 'vip']) || getBoolean(guestRecord, ['isVip', 'vip', 'vipStatus']),
    paymentStatus,
    roomAssigned: Boolean(roomNumber || roomId),
    roomLabel: roomNumber ? `Room ${roomNumber}` : 'Room not assigned',
    status: getString(dto, ['status'], 'CONFIRMED'),
  };
}

function mapRoom(dto: InventoryRoomDto): RoomView {
  return {
    id: getId(dto),
    number: getString(dto, ['roomNumber', 'number', 'displayName'], 'Room'),
    status: normalizeStatus(getString(dto, ['operationalStatus', 'operational_status', 'status'], 'READY')),
  };
}

function isRoomCleaning(status: string) {
  return ['DIRTY', 'NEEDS_CLEANING', 'CLEANING', 'CHECKOUT_DIRTY', 'WAITING_GUEST', 'INSPECTION'].includes(status);
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

function buildSummary(reservations: ReservationView[], rooms: RoomView[]): FrontDeskSummary {
  const today = todayKey();
  const reservationGuestsInHouse = reservations.filter((reservation) => isInHouseStatus(reservation.status)).length;
  const occupiedRooms = rooms.filter((room) => isRoomOccupied(room.status)).length;

  return {
    arrivalsToday: reservations.filter(
      (reservation) => reservation.arrivalDate === today && isArrivalStatus(reservation.status),
    ).length,
    departuresToday: reservations.filter(
      (reservation) => reservation.departureDate === today && normalizeStatus(reservation.status) !== 'CANCELLED',
    ).length,
    guestsInHouse: Math.max(reservationGuestsInHouse, occupiedRooms),
    paymentsDue: reservations.reduce(
      (total, reservation) =>
        hasPaymentDue(reservation.paymentStatus, reservation.balanceAmount)
          ? total + Math.max(0, reservation.balanceAmount)
          : total,
      0,
    ),
    roomsToClean: rooms.filter((room) => isRoomCleaning(room.status)).length,
  };
}

function minutesUntil(dateKeyValue: string) {
  if (dateKeyValue !== todayKey()) return undefined;
  return 18;
}

function buildTasks(reservations: ReservationView[], rooms: RoomView[]): FrontDeskTask[] {
  const today = todayKey();
  const tasks: FrontDeskTask[] = [];

  reservations.forEach((reservation) => {
    const isArrivalToday = reservation.arrivalDate === today && isArrivalStatus(reservation.status);
    const urgency = minutesUntil(reservation.arrivalDate);

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
        href: '/rooms',
      });
    }

    if (hasPaymentDue(reservation.paymentStatus, reservation.balanceAmount)) {
      tasks.push({
        id: `payment-${reservation.id}`,
        priority: isArrivalToday ? 'high' : 'medium',
        category: 'Payment',
        title: reservation.guestName,
        subtitle: `${reservation.id} - ${reservation.roomLabel}`,
        message:
          reservation.balanceAmount > 0
            ? `INR ${reservation.balanceAmount.toLocaleString('en-IN')} balance is pending.`
            : 'Payment is still pending.',
        signal: 'Payment pending',
        action: reservation.balanceAmount > 0 ? `Collect INR ${reservation.balanceAmount.toLocaleString('en-IN')}` : 'Collect Payment',
        tone: 'amber',
        href: '/requests',
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

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = properties.find((property) => isActiveProperty(property));
  const propertyId = activeProperty ? getId(activeProperty) : '';

  if (!activeProperty || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return propertyId;
}

async function loadFrontDesk(signal?: AbortSignal): Promise<Omit<FrontDeskState, 'isLoading' | 'error'>> {
  const propertyId = await getCurrentProperty(signal);
  const [reservationDtos, roomDtos, guestDtos] = await Promise.all([
    getPropertyReservations(propertyId, signal),
    getPropertyRooms(propertyId, signal),
    getPropertyGuests(propertyId, signal),
  ]);
  const guests = createLookup(guestDtos);
  const reservations = reservationDtos.map((reservation) => mapReservation(reservation, guests));
  const rooms = roomDtos.map(mapRoom);

  return {
    propertyId,
    summary: buildSummary(reservations, rooms),
    tasks: buildTasks(reservations, rooms),
  };
}

export function useFrontDeskData(): FrontDeskState & { refreshFrontDesk: () => Promise<void> } {
  const [state, setState] = useState<FrontDeskState>({
    isLoading: true,
    summary: emptySummary,
    tasks: [],
  });

  const refreshFrontDesk = useCallback(async (signal?: AbortSignal) => {
    setState((current) => ({ ...current, error: undefined, isLoading: current.tasks.length === 0 }));

    try {
      const data = await loadFrontDesk(signal);
      setState({ ...data, isLoading: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Front Desk dashboard API failed', error);
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Front Desk data is temporarily unavailable.',
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshFrontDesk(controller.signal);
    return () => controller.abort();
  }, [refreshFrontDesk]);

  return { ...state, refreshFrontDesk };
}
