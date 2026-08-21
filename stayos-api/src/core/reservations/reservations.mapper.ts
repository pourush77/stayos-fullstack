import { ReservationResponseDto } from './dto/reservation-response.dto';
import { ReservationEntity } from './infrastructure/reservation.entity';

type RateSnapshotView = {
  pricingStatus?: string;
  ratePlan?: { id?: unknown; code?: unknown; name?: unknown };
  mealPlan?: unknown;
  refundable?: unknown;
  nights?: Array<{ nightTotal?: unknown; roomRate?: unknown }>;
};

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
      childAges: entity.childAges,
      roomTypeId: entity.roomTypeId,
      roomId: entity.roomId,
      source: entity.source,
      sourceProvider: entity.sourceProvider ?? null,
      externalReservationId: entity.externalReservationId ?? null,
      externalConfirmationId: entity.externalConfirmationId ?? null,
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
      bookedRatePlan: this.toBookedRatePlan(entity),
      lateCheckoutApprovedUntil: entity.lateCheckoutApprovedUntil ?? null,
      lateCheckoutApprovedAt: entity.lateCheckoutApprovedAt ?? null,
      lateCheckoutApprovedBy: entity.lateCheckoutApprovedBy ?? null,
      lateCheckoutNotes: entity.lateCheckoutNotes ?? null,
    };
  }

  private static toBookedRatePlan(entity: ReservationEntity): ReservationResponseDto['bookedRatePlan'] {
    const snapshot = (entity.rateSnapshot ?? {}) as RateSnapshotView;
    if (snapshot.pricingStatus !== 'PRICED' && !entity.ratePlanId) return null;

    const ratePlan = snapshot.ratePlan ?? {};
    const nightlyRate = Array.isArray(snapshot.nights) && snapshot.nights.length > 0
      ? snapshot.nights[0].nightTotal ?? snapshot.nights[0].roomRate
      : null;

    return {
      id: typeof ratePlan.id === 'string' ? ratePlan.id : entity.ratePlanId,
      code: typeof ratePlan.code === 'string' ? ratePlan.code : null,
      name: typeof ratePlan.name === 'string' ? ratePlan.name : null,
      mealPlan: typeof snapshot.mealPlan === 'string' ? snapshot.mealPlan : null,
      refundable: typeof snapshot.refundable === 'boolean' ? snapshot.refundable : null,
      nightlyRate: typeof nightlyRate === 'string' ? nightlyRate : null,
    };
  }
}
