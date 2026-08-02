import { GuestResponseDto } from './dto/guest-response.dto';
import { GuestEntity } from './infrastructure/guest.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';

type GuestWithReservations = GuestEntity & {
  reservations?: Array<
    Pick<
      ReservationEntity,
      | 'arrivalDate'
      | 'departureDate'
      | 'id'
      | 'paymentStatus'
      | 'reservationCode'
      | 'room'
      | 'roomType'
      | 'status'
    > & {
      folioId?: string;
      folioNumber?: string;
      folioStatus?: string;
    }
  >;
};

export class GuestsMapper {
  static toResponse(entity: GuestWithReservations): GuestResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      firstName: entity.firstName,
      lastName: entity.lastName,
      displayName: entity.displayName,
      phone: entity.phone,
      alternatePhone: entity.alternatePhone,
      email: entity.email,
      gender: entity.gender,
      dateOfBirth: entity.dateOfBirth,
      anniversaryDate: entity.anniversaryDate,
      nationality: entity.nationality,
      preferredLanguage: entity.preferredLanguage,
      roomPreference: entity.roomPreference ?? null,
      bedPreference: entity.bedPreference ?? null,
      smokingPreference: entity.smokingPreference ?? null,
      floorPreference: entity.floorPreference ?? null,
      dietaryNotes: entity.dietaryNotes ?? null,
      companyName: entity.companyName,
      gstNumber: entity.gstNumber,
      vipStatus: entity.vipStatus,
      blacklistStatus: entity.blacklistStatus,
      notes: entity.notes,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      reservations: (entity.reservations ?? []).map((reservation) => ({
        id: reservation.id,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        reservationCode: reservation.reservationCode,
        status: reservation.status,
        paymentStatus: reservation.paymentStatus,
        roomNumber: reservation.room?.roomNumber ?? null,
        roomType: reservation.roomType?.name ?? null,
        folioId: reservation.folioId ?? null,
        folioNumber: reservation.folioNumber ?? null,
        folioStatus: reservation.folioStatus ?? null,
      })),
    };
  }
}
