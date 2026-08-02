import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import {
  ActivityFeedItemDto,
  AvailableRoomDto,
  NeedsAttentionItemDto,
  OperationsAttentionLevel,
  OperationsPriority,
  OperationsReservationSummaryDto,
  OperationsRoomUiStatus,
  RoomBoardItemDto,
} from '../dto/operations.dto';

export class OperationsMapper {
  static toRoomBoardItem(
    room: RoomEntity,
    currentStay: ReservationEntity | null,
    today: string,
  ): RoomBoardItemDto {
    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      floor: {
        id: room.floorId,
        name: room.floor?.name ?? '',
        floorNumber: room.floor?.floorNumber ?? 0,
      },
      roomType: {
        id: room.roomTypeId,
        code: room.roomType?.code ?? '',
        name: room.roomType?.name ?? '',
      },
      uiStatus: this.toUiStatus(room.operationalStatus),
      operationalStatus: room.operationalStatus,
      currentStay: currentStay ? this.toReservationSummary(currentStay) : null,
      checkoutLabel: currentStay ? this.toCheckoutLabel(currentStay.departureDate, today) : null,
      primaryAction: this.toPrimaryAction(room, currentStay),
      attentionLevel: this.toAttentionLevel(room, currentStay, today),
    };
  }

  static toAvailableRoom(room: RoomEntity): AvailableRoomDto {
    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      floor: {
        id: room.floorId,
        name: room.floor?.name ?? '',
        floorNumber: room.floor?.floorNumber ?? 0,
      },
      roomType: {
        id: room.roomTypeId,
        code: room.roomType?.code ?? '',
        name: room.roomType?.name ?? '',
      },
      operationalStatus: room.operationalStatus,
      maxOccupancy: room.roomType?.maxOccupancy ?? 0,
      primaryAction: 'Assign Guest',
    };
  }

  static toReservationSummary(reservation: ReservationEntity): OperationsReservationSummaryDto {
    return {
      reservationId: reservation.id,
      reservationCode: reservation.reservationCode,
      guestId: reservation.guestId,
      guestName: reservation.guest?.displayName ?? '',
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
    };
  }

  static toGuestSummary(guest: GuestEntity | null | undefined): Record<string, unknown> | null {
    if (!guest) {
      return null;
    }

    return {
      guestId: guest.id,
      displayName: guest.displayName,
      phone: guest.phone,
      email: guest.email,
      vipStatus: guest.vipStatus,
      blacklistStatus: guest.blacklistStatus,
    };
  }

  static toActivityFeedItem(activity: ActivityEventEntity): ActivityFeedItemDto {
    return {
      title: activity.title,
      description: activity.description,
      timestamp: activity.createdAt,
      entity: {
        type: activity.entityType,
        id: activity.entityId,
      },
      metadata: activity.metadata,
    };
  }

  static toAuditTimelineItem(audit: AuditEventEntity): Record<string, unknown> {
    return {
      action: audit.action,
      entity: {
        type: audit.entityType,
        id: audit.entityId,
      },
      previousState: audit.previousState,
      nextState: audit.nextState,
      metadata: audit.metadata,
      timestamp: audit.createdAt,
    };
  }

  static toAttentionItem(input: {
    type: string;
    title: string;
    description: string;
    priority: OperationsPriority;
    relatedEntity: { type: string; id: string };
    primaryAction: string;
  }): NeedsAttentionItemDto {
    return input;
  }

  private static toUiStatus(status: RoomOperationalStatus): OperationsRoomUiStatus {
    switch (status) {
      case RoomOperationalStatus.READY:
        return OperationsRoomUiStatus.READY;
      case RoomOperationalStatus.OCCUPIED:
        return OperationsRoomUiStatus.OCCUPIED;
      case RoomOperationalStatus.NEEDS_CLEANING:
      case RoomOperationalStatus.INSPECTION:
        return OperationsRoomUiStatus.CLEANING;
      case RoomOperationalStatus.MAINTENANCE:
        return OperationsRoomUiStatus.MAINTENANCE;
      case RoomOperationalStatus.OUT_OF_ORDER:
      case RoomOperationalStatus.OUT_OF_SERVICE:
        return OperationsRoomUiStatus.UNAVAILABLE;
    }
  }

  private static toCheckoutLabel(departureDate: string, today: string): string {
    const tomorrow = new Date(`${today}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowValue = tomorrow.toISOString().slice(0, 10);

    if (departureDate === today) {
      return 'Checkout Today';
    }

    if (departureDate === tomorrowValue) {
      return 'Checkout Tomorrow';
    }

    const date = new Date(`${departureDate}T00:00:00.000Z`);

    return `Checkout ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })}`;
  }

  private static toPrimaryAction(room: RoomEntity, currentStay: ReservationEntity | null): string {
    if (currentStay?.status === ReservationStatus.CHECKED_IN) {
      return 'Open Stay';
    }

    if (
      currentStay &&
      [ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(currentStay.status)
    ) {
      return room.operationalStatus === RoomOperationalStatus.READY ? 'Check In' : 'View Details';
    }

    if (
      [RoomOperationalStatus.NEEDS_CLEANING, RoomOperationalStatus.INSPECTION].includes(
        room.operationalStatus,
      )
    ) {
      return 'View Progress';
    }

    if (room.operationalStatus === RoomOperationalStatus.READY) {
      return 'Assign Guest';
    }

    return 'View Details';
  }

  private static toAttentionLevel(
    room: RoomEntity,
    currentStay: ReservationEntity | null,
    today: string,
  ): OperationsAttentionLevel {
    if (
      [RoomOperationalStatus.OUT_OF_ORDER, RoomOperationalStatus.OUT_OF_SERVICE].includes(
        room.operationalStatus,
      )
    ) {
      return OperationsAttentionLevel.CRITICAL;
    }

    if (
      room.operationalStatus === RoomOperationalStatus.MAINTENANCE ||
      room.operationalStatus === RoomOperationalStatus.NEEDS_CLEANING ||
      currentStay?.departureDate === today ||
      currentStay?.paymentStatus === ReservationPaymentStatus.PAYMENT_DUE
    ) {
      return OperationsAttentionLevel.WARNING;
    }

    return OperationsAttentionLevel.NORMAL;
  }
}
