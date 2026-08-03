import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { GroupBookingRoomAssignmentEntity } from '../infrastructure/group-booking-room-assignment.entity';
import { GroupMasterFolioEntity } from '../infrastructure/group-master-folio.entity';
import { RoomBoardItemDto } from '../dto/operations.dto';
import { GroupBookingStatus } from '../domain/group-booking-status.enum';
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
    @InjectRepository(GroupBookingRoomAssignmentEntity)
    private readonly roomAssignmentsRepository: Repository<GroupBookingRoomAssignmentEntity>,
    @InjectRepository(GroupMasterFolioEntity)
    private readonly groupMasterFoliosRepository: Repository<GroupMasterFolioEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getRoomBoard(propertyId: string): Promise<RoomBoardItemDto[]> {
    await this.propertiesService.findOne(propertyId);

    const today = todayIsoDate();

    const [rooms, currentStays, assignedReservations, groupAssignments, folios] = await Promise.all(
      [
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
          .andWhere('reservation.arrivalDate <= :today', { today })
          .andWhere('reservation.departureDate > :today', { today })
          .orderBy('reservation.arrivalDate', 'ASC')
          .getMany(),
        this.roomAssignmentsRepository.find({
          where: { room: { propertyId } },
          relations: { groupBooking: true, room: true },
        }),
        this.groupMasterFoliosRepository.find({ where: { propertyId } }),
      ],
    );

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

    const folioByGroupBookingId = new Map(folios.map((folio) => [folio.groupBookingId, folio]));
    const groupAssignmentByRoomId = new Map<string, GroupBookingRoomAssignmentEntity>();
    groupAssignments.forEach((assignment) => {
      if (assignment.roomId) {
        groupAssignmentByRoomId.set(assignment.roomId, assignment);
      }
    });

    return rooms.map((room) => {
      const currentStay = currentStayByRoomId.get(room.id);
      const assignedReservation = assignedReservationByRoomId.get(room.id);
      const groupAssignment = groupAssignmentByRoomId.get(room.id);
      const isActiveGroupAssignment =
        !!groupAssignment?.groupBooking &&
        groupAssignment.groupBooking.status !== GroupBookingStatus.CHECKED_OUT;
      const groupContext = isActiveGroupAssignment
        ? {
            groupBookingId: groupAssignment.groupBooking.id,
            groupCode: groupAssignment.groupBooking.groupCode,
            groupName: groupAssignment.groupBooking.groupName,
            masterFolioId: folioByGroupBookingId.get(groupAssignment.groupBooking.id)?.id ?? '',
            masterFolioNumber:
              folioByGroupBookingId.get(groupAssignment.groupBooking.id)?.folioNumber ??
              'Master folio pending',
            status: folioByGroupBookingId.get(groupAssignment.groupBooking.id)?.status ?? 'OPEN',
          }
        : null;

      return OperationsMapper.toRoomBoardItem(
        room,
        currentStay ?? assignedReservation ?? null,
        today,
        groupContext,
      );
    });
  }
}
