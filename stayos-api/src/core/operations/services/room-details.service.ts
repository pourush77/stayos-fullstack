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
import { RoomDrawerDto } from '../dto/operations.dto';
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

    const [currentReservation, upcomingReservations, recentActivity, auditTimeline] =
      await Promise.all([
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
      ]);

    return {
      roomSummary: OperationsMapper.toRoomBoardItem(room, currentReservation, today),
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
