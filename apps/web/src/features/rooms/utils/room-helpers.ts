import type { Reservation } from '../../../lib/reservation-hooks';
import type { FiltersState, Room } from '../types';
import { statusGroup, statusLabel } from './room-status';

export function isRoomReadyForAssignment(room: Room) {
  return room.status === 'ready' || room.status === 'vacant' || room.status === 'reserved';
}

export function hasAssignedBooking(room: Room) {
  return Boolean(room.bookingId || (room.guest && room.reservation !== 'Available'));
}

export function getRoomSubtitle(room: Room) {
  if (room.status === 'reserved' || (hasAssignedBooking(room) && room.status !== 'occupied')) {
    return room.guest ?? room.reservation ?? 'Assigned booking';
  }

  if (room.status === 'ready') return 'Vacant';
  if (room.status === 'occupied') return room.guest ?? 'Guest in house';
  if (room.status === 'cleaning' || room.status === 'dirty') return 'Waiting for housekeeping';
  if (room.status === 'inspection') return 'Inspection pending';
  if (room.status === 'maintenance') return 'Maintenance in progress';
  if (room.status === 'out-of-order') return 'Unavailable for sale';
  if (room.status === 'out-of-service') return 'Temporarily unavailable';
  if (room.status === 'vacant') return 'Vacant';

  return statusLabel(room.status);
}

export function parseGuestCount(occupancy: string) {
  const adults = occupancy.match(/(\d+)\s+Adult/i)?.[1];
  const children = occupancy.match(/(\d+)\s+Child/i)?.[1];
  const guests = occupancy.match(/(\d+)\s+Guest/i)?.[1];

  if (adults || children) return Number(adults ?? 0) + Number(children ?? 0);
  if (guests) return Number(guests);
  return 0;
}

export function parseRoomCapacity(capacity: string) {
  return Number(capacity.match(/\d+/)?.[0] ?? 0);
}

function normalizeRoomType(value: string) {
  return value
    .toLowerCase()
    .replace(/room type not connected|standard room/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function roomTypesMatch(roomType: string, bookingRoomType: string) {
  const room = normalizeRoomType(roomType);
  const booking = normalizeRoomType(bookingRoomType);

  if (!room || !booking) return true;
  return room.includes(booking) || booking.includes(room);
}

export function assignmentIssue(room: Room | null, reservation: Reservation) {
  if (!room) return 'Select a room first.';
  if (reservation.status !== 'Confirmed' && reservation.status !== 'Pending') {
    return 'This booking is not ready for room assignment.';
  }
  if (reservation.room !== 'Unassigned') {
    return 'This booking already has a room assigned.';
  }
  if (!isRoomReadyForAssignment(room)) {
    return 'This room is not ready for guest assignment yet.';
  }

  const roomCapacity = parseRoomCapacity(room.capacity);
  const guestCount = parseGuestCount(reservation.occupancy);

  if (roomCapacity > 0 && guestCount > roomCapacity) {
    return `This room can accommodate up to ${roomCapacity} guests. This booking has ${guestCount} guests. Please choose a larger room.`;
  }
  if (!roomTypesMatch(room.roomType, reservation.roomType)) {
    return 'This booking requires a different room type.';
  }

  return undefined;
}

export function roomMatches(room: Room, filters: FiltersState) {
  if (filters.status !== 'all' && statusGroup(room.status) !== filters.status) return false;
  if (filters.floor !== 'all' && room.floor !== filters.floor) return false;
  if (filters.roomType !== 'all' && room.roomType !== filters.roomType) return false;
  if (
    filters.housekeeping !== 'all' &&
    room.housekeeping.status.toLowerCase() !== filters.housekeeping
  )
    return false;
  if (
    filters.maintenance !== 'all' &&
    room.maintenance.status.toLowerCase() !== filters.maintenance
  )
    return false;
  if (filters.vip && !room.vip) return false;
  if (filters.accessible && !room.accessible) return false;
  if (filters.connecting && !room.connecting) return false;

  const normalized = filters.query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    room.number,
    room.guest,
    room.bookingId,
    room.roomType,
    room.floor,
    room.housekeeping.status,
    room.maintenance.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}
