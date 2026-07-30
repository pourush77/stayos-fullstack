import { GuestResponseDto } from './dto/guest-response.dto';
import { GuestEntity } from './infrastructure/guest.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';

type GuestWithReservations = GuestEntity & {
  reservations?: Pick<ReservationEntity, 'arrivalDate' | 'id'>[];
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
      })),
    };
  }
}
