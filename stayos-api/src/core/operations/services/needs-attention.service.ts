import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { NeedsAttentionItemDto, OperationsPriority } from '../dto/operations.dto';
import { OperationsMapper } from '../mappers/operations.mapper';
import { todayIsoDate } from './operations-query.helpers';
import { resolveCheckoutOperationalState } from './checkout-operational-state.resolver';

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
    const property = await this.propertiesService.findOne(propertyId);
    const today = todayIsoDate(property.timezone ?? 'UTC');
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
          where: {
            propertyId,
            departureDate: LessThanOrEqual(today),
            status: ReservationStatus.CHECKED_IN,
          },
          relations: { guest: true, room: true },
        }),
        this.reservationsRepository.find({
          where: {
            propertyId,
            paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
            status: In([ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]),
          },
          relations: { guest: true, room: true },
        }),
      ]);

    const items: NeedsAttentionItemDto[] = [];

    unassignedArrivals.forEach((reservation) =>
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'UNASSIGNED_ARRIVAL',
          title: reservation.guest?.displayName ?? 'Guest',
          description: `${reservation.guest?.displayName ?? 'Guest'} arrives today without an assigned room.`,
          priority: OperationsPriority.HIGH,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Assign Room',
          category: 'Arrival',
          signal: 'Action needed',
          metadata: {
            reservationCode: reservation.reservationCode,
            guestName: reservation.guest?.displayName ?? 'Guest',
            roomNumber: null,
            arrivalDate: reservation.arrivalDate,
          },
        }),
      ),
    );

    vipUnassignedArrivals.forEach((reservation) =>
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'VIP_UNASSIGNED_ARRIVAL',
          title: reservation.guest?.displayName ?? 'VIP Guest',
          description: `${reservation.guest?.displayName ?? 'VIP guest'} arrives today without an assigned room.`,
          priority: OperationsPriority.CRITICAL,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Assign Room',
          category: 'VIP',
          signal: 'VIP Arrival',
          metadata: {
            reservationCode: reservation.reservationCode,
            guestName: reservation.guest?.displayName ?? 'VIP Guest',
            roomNumber: null,
            arrivalDate: reservation.arrivalDate,
          },
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
        const isOutOfOrder = room.operationalStatus === RoomOperationalStatus.OUT_OF_ORDER;
        const isMaintenance = room.operationalStatus === RoomOperationalStatus.MAINTENANCE;
        items.push(
          OperationsMapper.toAttentionItem({
            type: isOutOfOrder
              ? 'ROOM_OUT_OF_ORDER'
              : isMaintenance
                ? 'ROOM_MAINTENANCE'
                : 'ROOM_CLEANING_DELAYED',
            title: `Room ${room.roomNumber}`,
            description: isOutOfOrder
              ? `Room ${room.roomNumber} is out of order.`
              : isMaintenance
                ? `Room ${room.roomNumber} requires maintenance.`
                : `Room ${room.roomNumber} cleaning is delayed.`,
            priority: isOutOfOrder
              ? OperationsPriority.CRITICAL
              : isMaintenance
                ? OperationsPriority.HIGH
                : OperationsPriority.MEDIUM,
            relatedEntity: { type: 'Room', id: room.id },
            primaryAction: isOutOfOrder || isMaintenance ? 'View Room' : 'View Progress',
            category: isOutOfOrder || isMaintenance ? 'Maintenance' : 'Room Ready',
            signal: isOutOfOrder ? 'Out of order' : isMaintenance ? 'Maintenance' : 'Needs cleaning',
            metadata: {
              roomNumber: room.roomNumber,
              operationalStatus: room.operationalStatus,
            },
          }),
        );
      }
    });

    const now = new Date();
    checkedInDepartures.forEach((reservation) => {
      const resolution = resolveCheckoutOperationalState(reservation, property, now);
      const guestName = reservation.guest?.displayName ?? 'Guest';
      const roomNumber = reservation.room?.roomNumber ?? null;

      items.push(
        OperationsMapper.toAttentionItem({
          type: resolution.status,
          title: guestName,
          description: resolution.description,
          priority: resolution.priority,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Open Stay',
          category: 'Checkout',
          signal: resolution.signal,
          metadata: {
            reservationCode: reservation.reservationCode,
            guestName,
            roomNumber,
            departureDate: reservation.departureDate,
            effectiveCheckoutTime: resolution.effectiveCheckoutTime,
            standardCheckOutTime: resolution.standardCheckOutTime,
            approvedLateCheckoutUntil: resolution.approvedLateCheckoutUntil,
            minutesOverdue: resolution.minutesOverdue,
            minutesRemaining: resolution.minutesRemaining,
            isOverdue: resolution.isOverdue,
            isLateCheckout: resolution.isLateCheckout,
          },
        }),
      );
    });

    pendingPayments.forEach((reservation) => {
      const guestName = reservation.guest?.displayName ?? 'Guest';
      const roomNumber = reservation.room?.roomNumber ?? null;
      items.push(
        OperationsMapper.toAttentionItem({
          type: 'PENDING_PAYMENT',
          title: guestName,
          description: `${reservation.reservationCode} has payment due.`,
          priority: OperationsPriority.HIGH,
          relatedEntity: { type: 'Reservation', id: reservation.id },
          primaryAction: 'Collect Payment',
          category: reservation.status === ReservationStatus.CHECKED_IN ? 'Checkout' : 'Arrival',
          signal: 'Payment due',
          metadata: {
            reservationCode: reservation.reservationCode,
            guestName,
            roomNumber,
          },
        }),
      );
    });

    return items;
  }
}
