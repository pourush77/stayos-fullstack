import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { NeedsAttentionItemDto, OperationsPriority } from '../dto/operations.dto';
import { OperationsMapper } from '../mappers/operations.mapper';
import { todayIsoDate } from './operations-query.helpers';

@Injectable()
export class NeedsAttentionService {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getNeedsAttention(propertyId: string): Promise<NeedsAttentionItemDto[]> {
    await this.propertiesService.findOne(propertyId);
    const today = todayIsoDate();
    const cleaningThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const [unassignedArrivals, vipUnassignedArrivals, rooms, checkedInDepartures, pendingPayments] =
      await Promise.all([
        this.reservationsRepository.find({
          where: {
            propertyId,
            arrivalDate: today,
            roomId: IsNull(),
            status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
          },
          relations: { guest: true },
        }),
        this.reservationsRepository.find({
          where: {
            propertyId,
            arrivalDate: today,
            roomId: IsNull(),
            status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
            guest: { vipStatus: true },
          },
          relations: { guest: true },
        }),
        this.roomsRepository.find({
          where: {
            propertyId,
            operationalStatus: In([
              RoomOperationalStatus.MAINTENANCE,
              RoomOperationalStatus.OUT_OF_ORDER,
              RoomOperationalStatus.NEEDS_CLEANING,
            ]),
          },
        }),
        this.reservationsRepository.find({
          where: { propertyId, departureDate: today, status: ReservationStatus.CHECKED_IN },
          relations: { guest: true },
        }),
        this.reservationsRepository.find({
          where: {
            propertyId,
            paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
            status: In([ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]),
          },
          relations: { guest: true },
        }),
      ]);

    const items: NeedsAttentionItemDto[] = [];

    unassignedArrivals.forEach((reservation) =>
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'UNASSIGNED_ARRIVAL',
          title: 'Assign Room',
          description: `${reservation.guest?.displayName ?? 'Guest'} arrives today without an assigned room.`,
          priority: OperationsPriority.HIGH,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Assign Room',
        }),
      ),
    );

    vipUnassignedArrivals.forEach((reservation) =>
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'VIP_UNASSIGNED_ARRIVAL',
          title: 'VIP arrival needs room',
          description: `${reservation.guest?.displayName ?? 'VIP guest'} arrives today without an assigned room.`,
          priority: OperationsPriority.CRITICAL,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Assign Room',
        }),
      ),
    );

    rooms.forEach((room) => {
      const cleaningLongerThanThreshold =
        room.operationalStatus === RoomOperationalStatus.NEEDS_CLEANING &&
        room.updatedAt < cleaningThreshold;

      if (
        room.operationalStatus !== RoomOperationalStatus.NEEDS_CLEANING ||
        cleaningLongerThanThreshold
      ) {
        items.push(
          OperationsMapper.toAttentionItem({
            type:
              room.operationalStatus === RoomOperationalStatus.OUT_OF_ORDER
                ? 'ROOM_OUT_OF_ORDER'
                : room.operationalStatus === RoomOperationalStatus.MAINTENANCE
                  ? 'ROOM_MAINTENANCE'
                  : 'ROOM_CLEANING_DELAYED',
            title: 'View Room',
            description: `Room ${room.roomNumber} requires operational attention.`,
            priority:
              room.operationalStatus === RoomOperationalStatus.OUT_OF_ORDER
                ? OperationsPriority.CRITICAL
                : OperationsPriority.MEDIUM,
            relatedEntity: { type: 'Room', id: room.id },
            primaryAction: 'View Room',
          }),
        );
      }
    });

    checkedInDepartures.forEach((reservation) =>
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'DEPARTURE_TODAY',
          title: 'Open Stay',
          description: `${reservation.guest?.displayName ?? 'Guest'} is due to check out today.`,
          priority: OperationsPriority.MEDIUM,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Open Stay',
        }),
      ),
    );

    pendingPayments.forEach((reservation) =>
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'PENDING_PAYMENT',
          title: 'Collect Payment',
          description: `${reservation.reservationCode} has payment due.`,
          priority: OperationsPriority.HIGH,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Collect Payment',
        }),
      ),
    );

    return items;
  }
}
