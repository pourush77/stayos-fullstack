import type { GuestDto } from '../../../lib/guest-api';
import type { InventoryRoomTypeDto } from '../../../lib/inventory-api';
import type { OperationsAvailableRoomDto } from '../../../lib/operations-api';
import type { ReservationDto } from '../../../lib/reservation-api';
import type { AvailableRoomOption, Booking, BookingFormValues, BookingPaymentStatus, BookingSource, BookingStatus, GuestOption, RoomTypeOption } from '../types/booking.types';
import { calculateNights } from './booking-formatters';

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getNumber(record: Record<string, unknown> | undefined, keys: string[], fallback = 0) {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
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
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return undefined;
}

function normalizeStatus(value: string): BookingStatus {
  const normalized = value.toUpperCase().replace(/[\s-]/g, '_');
  if (normalized === 'PENDING') return 'PENDING';
  if (normalized === 'CHECKED_IN') return 'CHECKED_IN';
  if (normalized === 'CHECKED_OUT') return 'CHECKED_OUT';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'CANCELLED';
  return 'CONFIRMED';
}

function normalizePayment(value: string): BookingPaymentStatus {
  return value.toUpperCase().replace(/[\s-]/g, '_') === 'PAID' ? 'PAID' : 'PAYMENT_DUE';
}

function normalizeSource(value: string): BookingSource {
  const normalized = value.toUpperCase().replace(/[\s-]/g, '_');
  if (normalized === 'WALK_IN') return 'WALK_IN';
  if (normalized === 'OTA') return 'OTA';
  if (normalized === 'CORPORATE') return 'CORPORATE';
  return 'DIRECT';
}

export function mapGuestOption(dto: GuestDto): GuestOption {
  const firstName = getString(dto, ['firstName']);
  const lastName = getString(dto, ['lastName']);
  const label = getString(dto, ['displayName', 'fullName', 'name']) || [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed guest';
  return {
    email: getString(dto, ['email'], 'Not recorded'),
    id: getString(dto, ['id', '_id', 'uuid', 'guestId'], label.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    isVip: getBoolean(dto, ['vipStatus', 'vip', 'isVip']),
    label,
    nationality: getString(dto, ['nationality'], 'Not recorded'),
    phone: getString(dto, ['phone', 'mobile', 'phoneNumber'], 'Not recorded'),
  };
}

export function mapRoomTypeOption(dto: InventoryRoomTypeDto): RoomTypeOption {
  const label = getString(dto, ['name', 'displayName', 'title', 'code'], 'Room Type');
  const fallbackRate = label.toLowerCase().includes('suite') ? 6500 : label.toLowerCase().includes('deluxe') ? 3500 : 2800;
  return {
    baseRate: getNumber(dto, ['baseRate', 'base_rate', 'rate', 'nightlyRate', 'price'], fallbackRate),
    capacity: getNumber(dto, ['capacity', 'maxOccupancy', 'occupancy'], label.toLowerCase().includes('suite') ? 3 : 2),
    id: getString(dto, ['id', '_id', 'uuid', 'roomTypeId'], label.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    label,
  };
}

export function mapAvailableRoom(dto: OperationsAvailableRoomDto): AvailableRoomOption {
  return {
    id: dto.roomId,
    label: `Room ${dto.roomNumber}`,
    roomType: dto.roomType?.name ?? 'Room',
  };
}

export function mapBooking(dto: ReservationDto): Booking {
  const guest = getRecord(dto, ['guest', 'guestProfile']);
  const room = getRecord(dto, ['room']);
  const roomType = getRecord(dto, ['roomType']);
  const guestName = getString(dto, ['guestName'], getString(guest, ['displayName', 'fullName', 'name']) || [getString(guest, ['firstName']), getString(guest, ['lastName'])].filter(Boolean).join(' ') || 'Guest not connected');
  const arrivalDate = getString(dto, ['arrivalDate', 'checkInDate', 'startDate']).slice(0, 10);
  const departureDate = getString(dto, ['departureDate', 'checkOutDate', 'endDate']).slice(0, 10);
  const roomNumber = getString(dto, ['roomNumber'], getString(room, ['roomNumber', 'number']));
  const roomTypeName = getString(dto, ['roomTypeName'], getString(roomType, ['name', 'label', 'title'], 'Room type not connected'));

  return {
    adults: getNumber(dto, ['adults', 'numAdults', 'adultCount'], 1),
    arrivalDate,
    backendId: getString(dto, ['id', '_id', 'uuid']),
    bookingId: getString(dto, ['reservationCode', 'bookingCode', 'code', 'id'], 'Booking'),
    children: getNumber(dto, ['children', 'numChildren', 'childCount'], 0),
    departureDate,
    email: getString(dto, ['email'], getString(guest, ['email'], 'Not recorded')),
    guestId: getString(dto, ['guestId'], getString(guest, ['id', '_id', 'uuid'])) || undefined,
    guestName,
    isVip: getBoolean(dto, ['isVip', 'vip']) || getBoolean(guest, ['vipStatus', 'vip', 'isVip']),
    nationality: getString(dto, ['nationality'], getString(guest, ['nationality'], 'Not recorded')),
    nights: calculateNights(arrivalDate, departureDate),
    notes: getString(dto, ['notes', 'note'], 'No notes added.'),
    paymentStatus: normalizePayment(getString(dto, ['paymentStatus'], 'PAYMENT_DUE')),
    phone: getString(dto, ['phone', 'mobile'], getString(guest, ['phone', 'mobile', 'phoneNumber'], 'Not recorded')),
    room: roomNumber ? `Room ${roomNumber}` : 'Unassigned',
    roomId: getString(dto, ['roomId'], getString(room, ['id', '_id', 'uuid'])) || undefined,
    roomType: roomTypeName,
    roomTypeId: getString(dto, ['roomTypeId'], getString(roomType, ['id', '_id', 'uuid'])) || undefined,
    source: normalizeSource(getString(dto, ['source'], 'DIRECT')),
    specialRequests: getString(dto, ['specialRequests', 'requests'], 'None'),
    status: normalizeStatus(getString(dto, ['status'], 'CONFIRMED')),
  };
}

export function bookingToFormValues(booking?: Booking): BookingFormValues {
  return {
    adults: booking?.adults ?? 1,
    arrivalDate: booking?.arrivalDate ?? '',
    children: booking?.children ?? 0,
    departureDate: booking?.departureDate ?? '',
    guestId: booking?.guestId ?? '',
    notes: booking?.notes === 'No notes added.' ? '' : booking?.notes ?? '',
    paymentStatus: booking?.paymentStatus ?? 'PAYMENT_DUE',
    roomTypeId: booking?.roomTypeId ?? '',
    source: booking?.source ?? 'DIRECT',
    specialRequests: booking?.specialRequests === 'None' ? '' : booking?.specialRequests ?? '',
  };
}

export function formValuesToPayload(values: BookingFormValues) {
  return {
    adults: values.adults,
    arrivalDate: values.arrivalDate,
    children: values.children,
    departureDate: values.departureDate,
    guestId: values.guestId,
    notes: values.notes.trim() || undefined,
    paymentStatus: values.paymentStatus,
    roomTypeId: values.roomTypeId,
    source: values.source,
    specialRequests: values.specialRequests.trim() || 'None',
    status: 'CONFIRMED',
  };
}
