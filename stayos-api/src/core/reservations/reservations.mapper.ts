import { ReservationResponseDto } from './dto/reservation-response.dto';
import { ReservationEntity } from './infrastructure/reservation.entity';

export class ReservationsMapper {
  static toResponse(entity: ReservationEntity): ReservationResponseDto {
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
    };
  }
}
