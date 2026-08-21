import {
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { RoomTypeStatus } from '../../room-types/domain/room-type-status.enum';

export const activeReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

export const todayIsoDate = (timeZone = 'UTC', instant = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const findRoomsWithInventory = (
  roomsRepository: Repository<RoomEntity>,
  propertyId: string,
): Promise<RoomEntity[]> =>
  roomsRepository.find({
    where: { propertyId, status: RoomStatus.ACTIVE, roomType: { status: RoomTypeStatus.ACTIVE } },
    relations: { floor: true, roomType: true },
    order: { roomNumber: 'ASC' },
  });

/**
 * In-house stays are defined strictly by CHECKED_IN status and an assigned room,
 * not by the planned calendar departure date. A guest remains in-house until
 * Front Desk completes the checkout transition, even if the scheduled departure
 * date has passed.
 */
export const findCurrentRoomStays = (
  reservationsRepository: Repository<ReservationEntity>,
  propertyId: string,
  _today?: string,
): Promise<ReservationEntity[]> =>
  reservationsRepository.find({
    where: {
      propertyId,
      roomId: Not(IsNull()),
      status: ReservationStatus.CHECKED_IN,
    },
    relations: { guest: true },
  });

export const overlapsDateRange = (arrivalDate?: string, departureDate?: string) =>
  arrivalDate && departureDate
    ? {
        arrivalDate: LessThan(departureDate),
        departureDate: MoreThan(arrivalDate),
      }
    : {};

export const roomIsAssignable = (room: RoomEntity): boolean =>
  room.operationalStatus === RoomOperationalStatus.READY;
