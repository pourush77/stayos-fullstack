import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { GroupBookingRoomAssignmentEntity } from '../infrastructure/group-booking-room-assignment.entity';
import { GroupMasterFolioEntity } from '../infrastructure/group-master-folio.entity';
import { RoomDrawerDto } from '../dto/operations.dto';
import { GroupBookingStatus } from '../domain/group-booking-status.enum';
import { OperationsMapper } from '../mappers/operations.mapper';
import { todayIsoDate } from './operations-query.helpers';

@Injectable()
export class RoomDetailsService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(ActivityEventEntity)
    private readonly activityRepository: Repository<ActivityEventEntity>,
    @InjectRepository(AuditEventEntity)
    private readonly auditRepository: Repository<AuditEventEntity>,
    @InjectRepository(GroupBookingRoomAssignmentEntity)
    private readonly roomAssignmentsRepository: Repository<GroupBookingRoomAssignmentEntity>,
    @InjectRepository(GroupMasterFolioEntity)
    private readonly groupMasterFoliosRepository: Repository<GroupMasterFolioEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getRoomDetails(propertyId: string, roomId: string): Promise<RoomDrawerDto> {
    await this.propertiesService.findOne(propertyId);
    const today = todayIsoDate();
    const room = await this.roomsRepository.findOne({
      where: { id: roomId, propertyId },
      relations: { floor: true, roomType: true },
    });

    if (!room) {
      throw new NotFoundException({
        code: ApiErrorCode.ROOM_NOT_FOUND,
        message: `Room ${roomId} was not found`,
      });
    }

    const [
      currentReservation,
      upcomingReservations,
      recentActivity,
      auditTimeline,
      groupAssignments,
      folios,
    ] = await Promise.all([
      this.reservationsRepository.findOne({
        where: { propertyId, roomId, status: ReservationStatus.CHECKED_IN },
        relations: { guest: true },
        order: { arrivalDate: 'DESC' },
      }),
      this.reservationsRepository.find({
        where: {
          propertyId,
          roomId,
          status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
          arrivalDate: MoreThanOrEqual(today),
        },
        relations: { guest: true },
        order: { arrivalDate: 'ASC' },
        take: 1,
      }),
      this.activityRepository.find({
        where: { propertyId, entityType: 'Reservation' },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.auditRepository.find({
        where: { propertyId, entityType: 'Reservation' },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.roomAssignmentsRepository.find({
        where: { roomId, room: { propertyId } },
        relations: { groupBooking: true, room: true },
      }),
      this.groupMasterFoliosRepository.find({ where: { propertyId } }),
    ]);

    const groupAssignment = groupAssignments[0];
    const folio = folios.find((item) => item.groupBookingId === groupAssignment?.groupBookingId);
    const isActiveGroupAssignment =
      !!groupAssignment?.groupBooking &&
      groupAssignment.groupBooking.status !== GroupBookingStatus.CHECKED_OUT;
    const groupContext = isActiveGroupAssignment
      ? {
          groupBookingId: groupAssignment.groupBooking.id,
          groupCode: groupAssignment.groupBooking.groupCode,
          groupName: groupAssignment.groupBooking.groupName,
          masterFolioId: folio?.id ?? '',
          masterFolioNumber: folio?.folioNumber ?? 'Master folio pending',
          status: folio?.status ?? 'OPEN',
        }
      : null;

    return {
      roomSummary: OperationsMapper.toRoomBoardItem(room, currentReservation, today, groupContext),
      currentReservation: currentReservation
        ? OperationsMapper.toReservationSummary(currentReservation)
        : null,
      guestSummary: OperationsMapper.toGuestSummary(currentReservation?.guest),
      upcomingReservation: upcomingReservations[0]
        ? OperationsMapper.toReservationSummary(upcomingReservations[0])
        : null,
      operationalStatus: room.operationalStatus,
      availableActions: this.availableActions(Boolean(currentReservation), room.operationalStatus),
      recentActivity: recentActivity.map(OperationsMapper.toActivityFeedItem),
      auditTimeline: auditTimeline.map(OperationsMapper.toAuditTimelineItem),
    };
  }

  private availableActions(hasCurrentReservation: boolean, operationalStatus: string): string[] {
    if (hasCurrentReservation) {
      return ['Open Stay', 'Check Out'];
    }

    if (operationalStatus === 'READY') {
      return ['Assign Guest', 'Mark Maintenance'];
    }

    return ['View Room', 'Mark Ready'];
  }
}
