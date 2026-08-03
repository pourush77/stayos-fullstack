import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import {
  AssignableReservationDto,
  AssignableReservationsQueryDto,
} from '../dto/operations.dto';

const eligibleReservationStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.PENDING];
const activeAssignmentStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function guestName(reservation: ReservationEntity) {
  return (
    reservation.guest?.displayName ||
    [reservation.guest?.firstName, reservation.guest?.lastName].filter(Boolean).join(' ') ||
    ''
  ).trim();
}

@Injectable()
export class AssignableReservationsService {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getAssignableReservations(
    propertyId: string,
    query: AssignableReservationsQueryDto,
  ): Promise<AssignableReservationDto[]> {
    await this.propertiesService.findOne(propertyId);

    const room = query.roomId ? await this.getAssignableRoom(propertyId, query.roomId) : undefined;
    const today = todayKey();
    const reservations = await this.reservationsRepository.find({
      where: {
        propertyId,
        status: In(eligibleReservationStatuses),
        roomId: IsNull(),
      },
      relations: { guest: true, roomType: true },
    });

    const compatible = [];
    for (const reservation of reservations) {
      if (!this.isBaseEligible(propertyId, reservation, today)) continue;
      if (room && !(await this.isCompatibleWithRoom(propertyId, reservation, room))) continue;
      compatible.push(reservation);
    }

    return compatible
      .sort((a, b) => this.compareReservations(a, b, today))
      .map((reservation) => this.toDto(reservation, today));
  }

  private async getAssignableRoom(propertyId: string, roomId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: { roomType: true },
    });

    if (!room || room.propertyId !== propertyId) {
      throw new NotFoundException(`Room ${roomId} was not found`);
    }

    if (room.operationalStatus !== RoomOperationalStatus.READY) {
      throw new BadRequestException('Room must be ready for assignment');
    }

    return room;
  }

  private isBaseEligible(propertyId: string, reservation: ReservationEntity, today: string) {
    if (reservation.propertyId !== propertyId) return false;
    if (!eligibleReservationStatuses.includes(reservation.status)) return false;
    if (reservation.roomId) return false;
    if (!reservation.guestId || !guestName(reservation)) return false;
    if (!reservation.roomTypeId || !reservation.roomType) return false;
    if (reservation.departureDate < today) return false;
    return true;
  }

  private async isCompatibleWithRoom(
    propertyId: string,
    reservation: ReservationEntity,
    room: RoomEntity,
  ) {
    if (room.propertyId !== propertyId) return false;
    if (room.operationalStatus !== RoomOperationalStatus.READY) return false;
    if (room.roomTypeId !== reservation.roomTypeId) return false;

    const totalGuests = reservation.adults + reservation.children;
    if (
      totalGuests > room.roomType.maxOccupancy ||
      reservation.adults > room.roomType.maxAdults ||
      reservation.children > room.roomType.maxChildren
    ) {
      return false;
    }

    const overlapCount = await this.reservationsRepository.count({
      where: {
        propertyId,
        roomId: room.id,
        status: In(activeAssignmentStatuses),
        arrivalDate: LessThan(reservation.departureDate),
        departureDate: MoreThan(reservation.arrivalDate),
      },
    });

    return overlapCount === 0;
  }

  private compareReservations(a: ReservationEntity, b: ReservationEntity, today: string) {
    const aToday = a.arrivalDate === today ? 0 : 1;
    const bToday = b.arrivalDate === today ? 0 : 1;
    if (aToday !== bToday) return aToday - bToday;

    if (a.arrivalDate !== b.arrivalDate) return a.arrivalDate.localeCompare(b.arrivalDate);
    return guestName(a).localeCompare(guestName(b));
  }

  private toDto(reservation: ReservationEntity, today: string): AssignableReservationDto {
    return {
      adults: reservation.adults,
      arrivalDate: reservation.arrivalDate,
      arrivingToday: reservation.arrivalDate === today,
      bookedRoomTypeId: reservation.roomTypeId,
      bookedRoomTypeName: reservation.roomType.name,
      children: reservation.children,
      confirmationNumber: reservation.reservationCode,
      departureDate: reservation.departureDate,
      guestId: reservation.guestId,
      guestName: guestName(reservation),
      reservationId: reservation.id,
      reservationStatus: reservation.status,
      specialRequests: reservation.specialRequests,
      totalGuestCount: reservation.adults + reservation.children,
    };
  }
}
