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
import { RoomEntity } from '../../rooms/infrastructure/room.entity';

export const activeReservationStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

export const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export const findRoomsWithInventory = (
  roomsRepository: Repository<RoomEntity>,
  propertyId: string,
): Promise<RoomEntity[]> =>
  roomsRepository.find({
    where: { propertyId },
    relations: { floor: true, roomType: true },
    order: { roomNumber: 'ASC' },
  });

export const findCurrentRoomStays = (
  reservationsRepository: Repository<ReservationEntity>,
  propertyId: string,
  today: string,
): Promise<ReservationEntity[]> =>
  reservationsRepository.find({
    where: {
      propertyId,
      roomId: Not(IsNull()),
      status: In([ReservationStatus.CHECKED_IN]),
      arrivalDate: LessThanOrEqual(today),
      departureDate: MoreThanOrEqual(today),
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
