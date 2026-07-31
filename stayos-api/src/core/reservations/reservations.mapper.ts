import { ReservationResponseDto } from './dto/reservation-response.dto';
import { ReservationEntity } from './infrastructure/reservation.entity';

export class ReservationsMapper {
  static toResponse(entity: ReservationEntity): ReservationResponseDto {
    const guest = entity.guest;
    const guestName =
      guest?.displayName?.trim() ||
      [guest?.firstName, guest?.lastName].filter(Boolean).join(' ').trim() ||
      undefined;
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      guestId: entity.guestId,
      reservationCode: entity.reservationCode,
      arrivalDate: entity.arrivalDate,
      departureDate: entity.departureDate,
      adults: entity.adults,
      children: entity.children,
      roomTypeId: entity.roomTypeId,
      roomId: entity.roomId,
      source: entity.source,
      status: entity.status,
      paymentStatus: entity.paymentStatus,
      notes: entity.notes,
      specialRequests: entity.specialRequests,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      guestName,
      guestPhone: guest?.phone ?? undefined,
      guestEmail: guest?.email ?? undefined,
      roomTypeName: entity.roomType?.name ?? undefined,
      roomNumber: entity.room?.roomNumber ?? undefined,
    };
  }
}
