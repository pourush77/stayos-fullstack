import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { AvailableRoomDto, AvailableRoomsQueryDto } from '../dto/operations.dto';
import { OperationsMapper } from '../mappers/operations.mapper';
import {
  activeReservationStatuses,
  findRoomsWithInventory,
  overlapsDateRange,
} from './operations-query.helpers';

@Injectable()
export class RoomAvailabilityService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getAvailableRooms(
    propertyId: string,
    query: AvailableRoomsQueryDto,
  ): Promise<AvailableRoomDto[]> {
    await this.propertiesService.findOne(propertyId);

    if (query.arrivalDate && query.departureDate && query.departureDate <= query.arrivalDate) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'departureDate must be after arrivalDate',
      });
    }

    const rooms = await findRoomsWithInventory(this.roomsRepository, propertyId);
    const conflictingReservations =
      query.arrivalDate && query.departureDate
        ? await this.reservationsRepository.find({
            where: {
              propertyId,
              roomId: In(rooms.map((room) => room.id)),
              status: In(activeReservationStatuses),
              ...overlapsDateRange(query.arrivalDate, query.departureDate),
            },
          })
        : [];
    const conflictedRoomIds = new Set(
      conflictingReservations
        .filter((reservation) => reservation.roomId)
        .map((reservation) => reservation.roomId as string),
    );

    return rooms
      .filter((room) => room.operationalStatus === RoomOperationalStatus.READY)
      .filter((room) => !conflictedRoomIds.has(room.id))
      .filter((room) => !query.roomTypeId || room.roomTypeId === query.roomTypeId)
      .filter((room) => !query.guestCount || (room.roomType?.maxOccupancy ?? 0) >= query.guestCount)
      .filter((room) => !query.adults || (room.roomType?.maxAdults ?? 0) >= query.adults)
      .filter((room) => query.children === undefined || (room.roomType?.maxChildren ?? 0) >= query.children)
      .map(OperationsMapper.toAvailableRoom);
  }
}
