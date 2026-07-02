'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getProperties,
  getPropertyReservation,
  getPropertyReservations,
  type ReservationDto,
  type ReservationPropertyDto,
} from './reservation-api';
import { getPropertyGuests, type GuestDto } from './guest-api';
import {
  getPropertyRoomTypes,
  getPropertyRooms,
  type InventoryRoomDto,
  type InventoryRoomTypeDto,
} from './inventory-api';

export type BookingStatus =
  'Confirmed' | 'Checked-in' | 'Checked-out' | 'Pending' | 'Cancelled' | 'No-show';
export type PaymentStatus = 'Paid' | 'Payment Due' | 'Partially Paid';

export type Reservation = {
  amount: string;
  arrivalDate: string;
  backendId: string;
  checkInDate?: string;
  departureDate: string;
  email: string;
  guest: string;
  guestHref?: string;
  guestId?: string;
  id: string;
  isVip: boolean;
  nights: number;
  notes: string;
  occupancy: string;
  payment: PaymentStatus;
  phone: string;
  requests: string[];
  room: string;
  roomType: string;
  source: string;
  status: BookingStatus;
  stayDates: string;
  stayHref?: string;
  timeline: string[];
  nextAction: string;
};

export type ReservationSummary = {
  cancelled: number;
  pendingPayments: number;
  tomorrowArrivals: number;
  todayArrivals: number;
  unassignedRooms: number;
  vipBookings: number;
  checkedInToday: number;
  departuresToday: number;
};

type ReservationState = {
  activePropertyName?: string;
  error?: string;
  isFallback: boolean;
  isLoading: boolean;
  propertyId?: string;
  reservations: Reservation[];
  summary: ReservationSummary;
};

type ReservationDetailState = Omit<ReservationState, 'reservations' | 'summary'> & {
  reservation?: Reservation;
};

type ReservationHookOptions = {
  allowMockFallback: boolean;
  enabled: boolean;
};

const emptySummary: ReservationSummary = {
  cancelled: 0,
  pendingPayments: 0,
  tomorrowArrivals: 0,
  todayArrivals: 0,
  unassignedRooms: 0,
  vipBookings: 0,
  checkedInToday: 0,
  departuresToday: 0,
};

const mockReservations: Reservation[] = [
  {
    amount: 'INR 18,400',
    arrivalDate: '2026-06-28',
    backendId: 'ST1842',
    checkInDate: '2026-06-28',
    departureDate: '2026-07-01',
    email: 'ananya.rao@example.com',
    guest: 'Ananya Rao',
    guestHref: '/guests/ananya-rao',
    id: 'ST1842',
    isVip: true,
    nights: 3,
    notes: 'Demo fallback reservation.',
    occupancy: '2 Adults • 1 Child',
    payment: 'Partially Paid',
    phone: '+91 98765 22110',
    requests: ['Quiet floor'],
    room: 'Suite 212',
    roomType: 'Suite',
    source: 'Direct',
    status: 'Confirmed',
    stayDates: '28 Jun → 01 Jul',
    timeline: ['Demo fallback reservation'],
    nextAction: 'Prepare Arrival',
  },
];

type ReservationLookups = {
  guests: Map<string, GuestDto>;
  rooms: Map<string, InventoryRoomDto>;
  roomTypes: Map<string, InventoryRoomTypeDto>;
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
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return undefined;
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
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>;
  }

  return undefined;
}

function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

function getPropertyId(property: ReservationPropertyDto) {
  return getString(property, ['id', '_id', 'uuid', 'propertyId']);
}

function getPropertyName(property: ReservationPropertyDto) {
  return getString(property, ['name', 'title', 'displayName']);
}

function getActiveProperty(properties: ReservationPropertyDto[]) {
  return properties.find(isActiveRecord);
}

function createLookup<T extends Record<string, unknown>>(items: T[]) {
  return new Map(
    items
      .map((item) => [getString(item, ['id', '_id', 'uuid']), item] as const)
      .filter(([id]) => id),
  );
}

function formatSource(source: string) {
  const normalized = source.replace(/_/g, ' ').toLowerCase();
  if (!normalized) return 'Not recorded';
  if (normalized === 'ota') return 'OTA';
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapPaymentStatus(status: string): PaymentStatus {
  const normalized = status.toUpperCase().replace(/[\s-]/g, '_');
  if (normalized === 'PAID') return 'Paid';
  if (normalized === 'PARTIALLY_PAID' || normalized === 'PARTIAL') return 'Partially Paid';
  return 'Payment Due';
}

function mapBookingStatus(status: string): BookingStatus {
  const normalized = status.toUpperCase().replace(/[\s-]/g, '_');
  if (normalized === 'CHECKED_IN') return 'Checked-in';
  if (normalized === 'CHECKED_OUT') return 'Checked-out';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
  if (normalized === 'NO_SHOW') return 'No-show';
  if (normalized === 'PENDING') return 'Pending';
  return 'Confirmed';
}

function formatDateRange(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return 'Dates not recorded';

  return `${arrival.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → ${departure.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
    },
  )}`;
}

function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function tomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey(tomorrow);
}

function calculateNights(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return 0;

  return Math.max(0, Math.round((departure.getTime() - arrival.getTime()) / 86_400_000));
}

function splitRequests(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function guestName(guest: GuestDto | undefined) {
  if (!guest) return 'Guest not connected';
  return (
    getString(guest, ['name', 'fullName', 'displayName', 'guestName']) ||
    [getString(guest, ['firstName']), getString(guest, ['lastName'])].filter(Boolean).join(' ') ||
    'Guest not connected'
  );
}

function occupancyLabel(dto: ReservationDto, guestRecord: Record<string, unknown> | undefined) {
  const adults =
    getNumber(dto, ['adults', 'numAdults', 'adultCount']) ??
    getNumber(guestRecord, ['adults', 'numAdults', 'adultCount']);
  const children =
    getNumber(dto, ['children', 'numChildren', 'childCount']) ??
    getNumber(guestRecord, ['children', 'numChildren', 'childCount']);

  if (typeof adults === 'number' && typeof children === 'number') {
    const adultsLabel = `${adults} Adult${adults === 1 ? '' : 's'}`;
    const childrenLabel = `${children} Child${children === 1 ? '' : 'ren'}`;
    return `${adultsLabel} • ${childrenLabel}`;
  }

  if (typeof adults === 'number') {
    return `${adults} Adult${adults === 1 ? '' : 's'}`;
  }

  return 'Occupancy not recorded';
}

function mapReservation(dto: ReservationDto, lookups: ReservationLookups): Reservation {
  const guestRecord =
    getRecord(dto, ['guest', 'guestProfile']) ?? lookups.guests.get(getString(dto, ['guestId']));
  const roomRecord = getRecord(dto, ['room']) ?? lookups.rooms.get(getString(dto, ['roomId']));
  const roomTypeRecord =
    getRecord(dto, ['roomType']) ?? lookups.roomTypes.get(getString(dto, ['roomTypeId']));
  const code = getString(dto, ['reservationCode', 'code', 'bookingCode', 'id'], 'Reservation');
  const arrivalDate = getString(dto, ['arrivalDate', 'checkInDate', 'startDate']);
  const departureDate = getString(dto, ['departureDate', 'checkOutDate', 'endDate']);
  const checkInDate = getString(dto, ['checkInDate', 'arrivalDate', 'startDate']);
  const status = mapBookingStatus(getString(dto, ['status'], 'CONFIRMED'));
  const payment = mapPaymentStatus(getString(dto, ['paymentStatus'], 'PAYMENT_DUE'));
  const guestId = getString(dto, ['guestId'], getString(guestRecord, ['id', '_id', 'uuid']));
  const roomNumber = getString(roomRecord, ['roomNumber', 'number', 'displayName']);
  const roomType = getString(roomTypeRecord, ['name', 'label', 'title'], 'Room type not connected');

  return {
    amount: getString(dto, ['amount', 'totalAmount', 'balanceAmount'], 'Not connected'),
    arrivalDate,
    backendId: getString(dto, ['id', '_id', 'uuid'], code),
    checkInDate: checkInDate || undefined,
    departureDate,
    email: getString(dto, ['email'], getString(guestRecord, ['email'], 'Not recorded')),
    guest: guestName(guestRecord),
    guestHref: guestId ? `/guests/${guestId}` : undefined,
    guestId: guestId || undefined,
    id: code,
    isVip:
      getBoolean(dto, ['isVip', 'vip']) || getBoolean(guestRecord, ['isVip', 'vip', 'vipStatus']),
    nights: calculateNights(arrivalDate, departureDate),
    notes: getString(dto, ['notes', 'note'], 'No notes added.'),
    occupancy: occupancyLabel(dto, guestRecord),
    payment,
    phone: getString(
      dto,
      ['phone', 'mobile'],
      getString(guestRecord, ['phone', 'mobile', 'phoneNumber'], 'Not recorded'),
    ),
    requests: splitRequests(getString(dto, ['specialRequests', 'requests'])),
    room: roomNumber ? `${roomType} ${roomNumber}` : 'Unassigned',
    roomType,
    source: formatSource(getString(dto, ['source'])),
    status,
    stayDates: formatDateRange(arrivalDate, departureDate),
    stayHref: status === 'Checked-in' ? `/guest-stay/${code}` : undefined,
    timeline: [
      `Reservation ${code} loaded from backend`,
      `${status} status`,
      `${payment} payment status`,
    ],
    nextAction: nextActionFor({ payment, roomNumber, status, arrivalDate, checkInDate }),
  };
}

function nextActionFor({
  payment,
  roomNumber,
  status,
  arrivalDate,
  checkInDate,
}: {
  payment: PaymentStatus;
  roomNumber: string;
  status: BookingStatus;
  arrivalDate: string;
  checkInDate?: string;
}) {
  const today = dateKey(new Date());
  const tomorrow = tomorrowKey();

  if (status === 'Cancelled') return 'Archive';
  if (status === 'Checked-out') return 'View Folio';
  if (status === 'Checked-in') return 'View Stay';
  if (!roomNumber) return 'Assign Room';
  if (status === 'Pending') return 'Assign Room';
  if (payment === 'Payment Due') return 'Receive Payment';
  if (payment === 'Partially Paid') return 'Collect Balance';
  if (status === 'Confirmed' && arrivalDate === today) return 'Check-in';
  if (status === 'Confirmed' && arrivalDate === tomorrow) return 'Prepare Arrival';
  if (status === 'Confirmed' && checkInDate === today) return 'Check-in';
  if (status === 'Confirmed') return 'Prepare Arrival';
  return 'Review booking';
}

function arrivalStatusIncluded(status: BookingStatus) {
  return status === 'Confirmed' || status === 'Pending';
}

function calculateSummary(reservations: Reservation[]): ReservationSummary {
  const today = dateKey(new Date());
  const tomorrow = tomorrowKey();

  return {
    cancelled: reservations.filter((reservation) => reservation.status === 'Cancelled').length,
    pendingPayments: reservations.filter(
      (reservation) =>
        reservation.payment === 'Payment Due' || reservation.payment === 'Partially Paid',
    ).length,
    tomorrowArrivals: reservations.filter(
      (reservation) =>
        reservation.arrivalDate === tomorrow && arrivalStatusIncluded(reservation.status),
    ).length,
    todayArrivals: reservations.filter(
      (reservation) =>
        reservation.arrivalDate === today && arrivalStatusIncluded(reservation.status),
    ).length,
    unassignedRooms: reservations.filter((reservation) => reservation.room === 'Unassigned').length,
    vipBookings: reservations.filter((reservation) => reservation.isVip).length,
    checkedInToday: reservations.filter(
      (reservation) =>
        reservation.status === 'Checked-in' &&
        (reservation.checkInDate === today || !reservation.checkInDate),
    ).length,
    departuresToday: reservations.filter(
      (reservation) => reservation.departureDate === today && reservation.status !== 'Cancelled',
    ).length,
  };
}

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = getActiveProperty(properties);
  const propertyId = activeProperty ? getPropertyId(activeProperty) : '';

  if (!activeProperty || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return {
    propertyId,
    propertyName: getPropertyName(activeProperty),
  };
}

async function getReservationLookups(
  propertyId: string,
  signal?: AbortSignal,
): Promise<ReservationLookups> {
  const [guests, rooms, roomTypes] = await Promise.all([
    getPropertyGuests(propertyId, signal),
    getPropertyRooms(propertyId, signal),
    getPropertyRoomTypes(propertyId, signal),
  ]);

  return {
    guests: createLookup(guests),
    rooms: createLookup(rooms),
    roomTypes: createLookup(roomTypes),
  };
}

export function useReservations({
  allowMockFallback,
  enabled,
}: ReservationHookOptions): ReservationState & { refreshReservations: () => Promise<void> } {
  const [state, setState] = useState<ReservationState>({
    isFallback: false,
    isLoading: true,
    reservations: [],
    summary: emptySummary,
  });

  const loadReservations = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) {
        setState((currentState) => ({
          ...currentState,
          error: undefined,
          isFallback: false,
          isLoading: false,
          reservations: [],
          summary: emptySummary,
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        error: undefined,
        isLoading: currentState.reservations.length === 0,
      }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const [reservationDtos, lookups] = await Promise.all([
          getPropertyReservations(propertyId, signal),
          getReservationLookups(propertyId, signal),
        ]);
        const reservations = reservationDtos.map((reservation) =>
          mapReservation(reservation, lookups),
        );

        setState({
          activePropertyName: propertyName,
          isFallback: false,
          isLoading: false,
          propertyId,
          reservations,
          summary: calculateSummary(reservations),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (allowMockFallback) {
          setState({
            error: error instanceof Error ? error.message : 'Reservation API is unavailable.',
            isFallback: true,
            isLoading: false,
            reservations: mockReservations,
            summary: calculateSummary(mockReservations),
          });
          return;
        }

        setState({
          error: 'Reservations are temporarily unavailable.',
          isFallback: false,
          isLoading: false,
          reservations: [],
          summary: emptySummary,
        });
      }
    },
    [allowMockFallback, enabled],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadReservations(controller.signal);

    return () => controller.abort();
  }, [loadReservations]);

  const refreshReservations = useCallback(() => loadReservations(), [loadReservations]);

  return { ...state, refreshReservations };
}

export function useReservationDetails({
  allowMockFallback,
  enabled,
  reservationId,
}: ReservationHookOptions & { reservationId?: string }): ReservationDetailState & {
  refreshReservation: () => Promise<void>;
} {
  const [state, setState] = useState<ReservationDetailState>({
    isFallback: false,
    isLoading: false,
  });

  const loadReservation = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || !reservationId) {
        setState((currentState) => ({
          ...currentState,
          error: undefined,
          isFallback: false,
          isLoading: false,
          reservation: undefined,
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        error: undefined,
        isLoading: !currentState.reservation,
      }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const [reservationDto, lookups] = await Promise.all([
          getPropertyReservation(propertyId, reservationId, signal),
          getReservationLookups(propertyId, signal),
        ]);
        const reservation = mapReservation(reservationDto, lookups);

        setState({
          activePropertyName: propertyName,
          isFallback: false,
          isLoading: false,
          propertyId,
          reservation,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (allowMockFallback) {
          setState({
            error: error instanceof Error ? error.message : 'Reservation API is unavailable.',
            isFallback: true,
            isLoading: false,
            reservation: mockReservations[0],
          });
          return;
        }

        setState({
          error: 'Reservation details are temporarily unavailable.',
          isFallback: false,
          isLoading: false,
          reservation: undefined,
        });
      }
    },
    [allowMockFallback, enabled, reservationId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadReservation(controller.signal);

    return () => controller.abort();
  }, [loadReservation]);

  const refreshReservation = useCallback(() => loadReservation(), [loadReservation]);

  return { ...state, refreshReservation };
}
