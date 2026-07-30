import { Test, TestingModule } from '@nestjs/testing';
import { ReservationPaymentStatus } from './domain/reservation-payment-status.enum';
import { ReservationSource } from './domain/reservation-source.enum';
import { ReservationStatus } from './domain/reservation-status.enum';
import { ReservationsService } from './reservations.service';
import { StaysController } from './stays.controller';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

describe('StaysController', () => {
  let controller: StaysController;
  const reservationsService = {
    getStayWorkspace: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaysController],
      providers: [{ provide: ReservationsService, useValue: reservationsService }],
    }).compile();

    controller = module.get(StaysController);
  });

  it('delegates stay workspace read-model requests to the reservations service', async () => {
    const payload = {
      reservation: {
        id: reservationId,
        propertyId,
        guestId: 'guest-id',
        reservationCode: 'RSV-HILL-0001',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        children: 0,
        roomTypeId: 'room-type-id',
        roomId: null,
        source: ReservationSource.DIRECT,
        status: ReservationStatus.CHECKED_IN,
        paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
        notes: null,
        specialRequests: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      guest: { id: 'guest-id', displayName: 'Ada Lovelace' },
      room: { id: 'room-id', roomNumber: '101' },
      activity: [],
      payment: { status: 'PAYMENT_DUE' },
      allowedActions: { canCheckOut: true, canExtendStay: true, canMoveRoom: true },
      warnings: [],
    };

    reservationsService.getStayWorkspace.mockResolvedValue(payload);

    await expect(controller.getStayWorkspace(propertyId, reservationId)).resolves.toEqual(payload);
    expect(reservationsService.getStayWorkspace).toHaveBeenCalledWith(propertyId, reservationId);
  });
});
