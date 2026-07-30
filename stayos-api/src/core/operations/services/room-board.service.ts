import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { RoomBoardItemDto } from '../dto/operations.dto';
import { OperationsMapper } from '../mappers/operations.mapper';
import {
  findCurrentRoomStays,
  findRoomsWithInventory,
  todayIsoDate,
} from './operations-query.helpers';

@Injectable()
export class RoomBoardService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getRoomBoard(propertyId: string): Promise<RoomBoardItemDto[]> {
    await this.propertiesService.findOne(propertyId);

    const today = todayIsoDate();

    const [rooms, currentStays, assignedReservations] = await Promise.all([
      findRoomsWithInventory(this.roomsRepository, propertyId),
      findCurrentRoomStays(this.reservationsRepository, propertyId, today),
      this.reservationsRepository
        .createQueryBuilder('reservation')
        .leftJoinAndSelect('reservation.guest', 'guest')
        .leftJoinAndSelect('reservation.room', 'room')
        .leftJoinAndSelect('reservation.roomType', 'roomType')
        .where('reservation.propertyId = :propertyId', { propertyId })
        .andWhere('reservation.roomId IS NOT NULL')
        .andWhere('reservation.status IN (:...statuses)', {
          statuses: ['PENDING', 'CONFIRMED'],
        })
        .orderBy('reservation.arrivalDate', 'ASC')
        .getMany(),
    ]);

    const currentStayByRoomId = new Map(
      currentStays
        .filter((reservation) => reservation.roomId)
        .map((reservation) => [reservation.roomId as string, reservation]),
    );

    const assignedReservationByRoomId = new Map(
      assignedReservations
        .filter((reservation) => reservation.roomId)
        .map((reservation) => [reservation.roomId as string, reservation]),
    );

    return rooms.map((room) => {
      const currentStay = currentStayByRoomId.get(room.id);
      const assignedReservation = assignedReservationByRoomId.get(room.id);

      return OperationsMapper.toRoomBoardItem(
        room,
        currentStay ?? assignedReservation ?? null,
        today,
      );
    });
  }
}
