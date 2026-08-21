import { ReservationPaymentStatus } from './domain/reservation-payment-status.enum';
import { ReservationSource } from './domain/reservation-source.enum';
import { ReservationStatus } from './domain/reservation-status.enum';
import { ReservationsMapper } from './reservations.mapper';

describe('ReservationsMapper', () => {
  it('maps booked rate-plan terms from the persisted reservation snapshot', () => {
    const response = ReservationsMapper.toResponse({
      id: 'res-1',
      propertyId: 'prop-1',
      guestId: 'guest-1',
      guest: {
        displayName: 'Ananya Rao',
        firstName: 'Ananya',
        lastName: 'Rao',
        phone: '9876543210',
        email: 'ananya@example.com',
      },
      reservationCode: 'HS260821-00001',
      arrivalDate: '2026-09-01',
      departureDate: '2026-09-02',
      adults: 2,
      children: 0,
      childAges: null,
      roomTypeId: 'rt-1',
      roomType: { name: 'Deluxe' },
      roomId: null,
      room: null,
      ratePlanId: 'rp-nrf',
      rateSnapshot: {
        version: 1,
        pricingStatus: 'PRICED',
        ratePlan: {
          id: 'rp-nrf',
          code: 'NRF',
          name: 'Non-Refundable Saver',
        },
        mealPlan: 'ROOM_ONLY',
        refundable: false,
        nights: [{ date: '2026-09-01', nightTotal: '5300.00' }],
      },
      source: ReservationSource.FRONT_DESK,
      sourceProvider: null,
      externalReservationId: null,
      externalConfirmationId: null,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
      notes: null,
      specialRequests: null,
      createdAt: new Date('2026-08-21T00:00:00.000Z'),
      updatedAt: new Date('2026-08-21T00:00:00.000Z'),
      lateCheckoutApprovedUntil: null,
      lateCheckoutApprovedAt: null,
      lateCheckoutApprovedBy: null,
      lateCheckoutNotes: null,
    } as never);

    expect(response.bookedRatePlan).toEqual({
      id: 'rp-nrf',
      code: 'NRF',
      name: 'Non-Refundable Saver',
      mealPlan: 'ROOM_ONLY',
      refundable: false,
      nightlyRate: '5300.00',
    });
  });

  it('does not infer refundability from the rate-plan name or code', () => {
    const response = ReservationsMapper.toResponse({
      id: 'res-1',
      propertyId: 'prop-1',
      guestId: 'guest-1',
      reservationCode: 'HS260821-00001',
      arrivalDate: '2026-09-01',
      departureDate: '2026-09-02',
      adults: 2,
      children: 0,
      childAges: null,
      roomTypeId: 'rt-1',
      roomId: null,
      ratePlanId: 'rp-nrf',
      rateSnapshot: {
        version: 1,
        pricingStatus: 'PRICED',
        ratePlan: { id: 'rp-nrf', code: 'NRF', name: 'Non-Refundable Saver' },
      },
      source: ReservationSource.FRONT_DESK,
      sourceProvider: null,
      externalReservationId: null,
      externalConfirmationId: null,
      status: ReservationStatus.CONFIRMED,
      paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
      notes: null,
      specialRequests: null,
      createdAt: new Date('2026-08-21T00:00:00.000Z'),
      updatedAt: new Date('2026-08-21T00:00:00.000Z'),
      lateCheckoutApprovedUntil: null,
      lateCheckoutApprovedAt: null,
      lateCheckoutApprovedBy: null,
      lateCheckoutNotes: null,
    } as never);

    expect(response.bookedRatePlan?.refundable).toBeNull();
  });
});
