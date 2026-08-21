import { Test, TestingModule } from '@nestjs/testing';
import { BookingConfirmationEmailService } from '../notifications/email/booking-confirmation-email.service';
import { CheckoutInvoiceEmailService } from '../notifications/email/checkout-invoice-email.service';
import { ReservationPaymentStatus } from './domain/reservation-payment-status.enum';
import { ReservationSource } from './domain/reservation-source.enum';
import { ReservationStatus } from './domain/reservation-status.enum';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './services/check-in.service';
import { ReservationQuoteService } from './services/reservation-quote.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';

import { ReservationsMapper } from './reservations.mapper';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomTypeId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const reservationEntity: ReservationEntity = {
  id: reservationId,
  propertyId,
  property: undefined as never,
  guestId,
  guest: undefined as never,
  reservationCode: 'RSV-HILL-0001',
  arrivalDate: '2026-07-15',
  departureDate: '2026-07-17',
  adults: 2,
  children: 0,
  roomTypeId,
  roomType: undefined as never,
  roomId: null,
  room: null,
  inventoryReserved: true,
  ratePlanId: null,
  rateSnapshot: null,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

const reservationResponse = ReservationsMapper.toResponse(reservationEntity);

describe('ReservationsController', () => {
  let controller: ReservationsController;

  const reservationsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const reservationWorkflowService = {
    assignRoom: jest.fn(),
    unassignRoom: jest.fn(),
    extendStay: jest.fn(),
    moveRoom: jest.fn(),
    confirm: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    approveLateCheckout: jest.fn(),
  };

  const checkInService = {
    getWorkspace: jest.fn(),
    updateGuestRegistration: jest.fn(),
    updateIdentity: jest.fn(),
    reviewPayment: jest.fn(),
  };

  const reservationQuoteService = {
    quote: jest.fn(),
  };

  const bookingConfirmationEmailService = {
    queueAutomatic: jest.fn(),
    resend: jest.fn(),
  };

  const checkoutInvoiceEmailService = {
    queueAutomatic: jest.fn(),
    resend: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    bookingConfirmationEmailService.queueAutomatic.mockResolvedValue({
      queued: true,
      deliveryId: 'delivery-1',
    });

    bookingConfirmationEmailService.resend.mockResolvedValue({
      queued: true,
      deliveryId: 'delivery-resend-1',
    });

    checkoutInvoiceEmailService.queueAutomatic.mockResolvedValue({
      queued: true,
      deliveryId: 'checkout-delivery-1',
    });

    checkoutInvoiceEmailService.resend.mockResolvedValue({
      queued: true,
      deliveryId: 'checkout-delivery-resend-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: ReservationsService, useValue: reservationsService },
        { provide: ReservationWorkflowService, useValue: reservationWorkflowService },
        { provide: CheckInService, useValue: checkInService },
        { provide: ReservationQuoteService, useValue: reservationQuoteService },
        {
          provide: BookingConfirmationEmailService,
          useValue: bookingConfirmationEmailService,
        },
        {
          provide: CheckoutInvoiceEmailService,
          useValue: checkoutInvoiceEmailService,
        },
      ],
    }).compile();

    controller = module.get(ReservationsController);
  });

  it('returns a standard paginated list payload', async () => {
    reservationsService.findAll.mockResolvedValue({
      data: [reservationEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await expect(
      controller.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      success: true,
      message: 'Records fetched successfully.',
      data: [reservationResponse],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('delegates create requests to the service and queues booking confirmation', async () => {
    reservationsService.create.mockResolvedValue(reservationEntity);

    const payload = {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
    };

    await expect(controller.create(propertyId, payload)).resolves.toEqual(reservationResponse);

    expect(reservationsService.create).toHaveBeenCalledWith(propertyId, payload);
    expect(bookingConfirmationEmailService.queueAutomatic).toHaveBeenCalledWith(
      propertyId,
      reservationId,
    );
  });

  it('does not fail reservation creation when booking confirmation email queueing fails', async () => {
    reservationsService.create.mockResolvedValue(reservationEntity);
    bookingConfirmationEmailService.queueAutomatic.mockRejectedValue(
      new Error('Email infrastructure unavailable'),
    );

    const payload = {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
    };

    await expect(controller.create(propertyId, payload)).resolves.toEqual(reservationResponse);

    expect(reservationsService.create).toHaveBeenCalledWith(propertyId, payload);
  });

  it('delegates get-by-id requests to the service', async () => {
    reservationsService.findOne.mockResolvedValue(reservationEntity);

    await expect(controller.findOne(propertyId, reservationId)).resolves.toEqual(
      reservationResponse,
    );

    expect(reservationsService.findOne).toHaveBeenCalledWith(propertyId, reservationId);
  });

  it('delegates update requests to the service', async () => {
    reservationsService.update.mockResolvedValue({ ...reservationEntity });

    await expect(
      controller.update(propertyId, reservationId, { notes: 'Updated note' }),
    ).resolves.toEqual(reservationResponse);

    expect(reservationsService.update).toHaveBeenCalledWith(propertyId, reservationId, {
      notes: 'Updated note',
    });
  });

  it('delegates assign-room workflow requests', async () => {
    const workflowResponse = {
      reservation: reservationResponse,
      room: { id: 'room-id' },
    };

    reservationWorkflowService.assignRoom.mockResolvedValue(workflowResponse);

    await expect(
      controller.assignRoom(propertyId, reservationId, { roomId: 'room-id' }),
    ).resolves.toEqual(workflowResponse);

    expect(reservationWorkflowService.assignRoom).toHaveBeenCalledWith(
      propertyId,
      reservationId,
      { roomId: 'room-id' },
      { actorId: null },
    );
  });

  it('delegates move-room workflow requests', async () => {
    const workflowResponse = {
      reservation: { ...reservationResponse, roomId: 'target-room-id' },
      room: { id: 'target-room-id' },
    };

    reservationWorkflowService.moveRoom.mockResolvedValue(workflowResponse);

    await expect(
      controller.moveRoom(propertyId, reservationId, {
        roomId: 'target-room-id',
        reason: 'Guest requested quieter room',
      }),
    ).resolves.toEqual(workflowResponse);

    expect(reservationWorkflowService.moveRoom).toHaveBeenCalledWith(
      propertyId,
      reservationId,
      {
        roomId: 'target-room-id',
        reason: 'Guest requested quieter room',
      },
      { actorId: null },
    );
  });

  it('delegates approve-late-checkout workflow requests', async () => {
    const workflowResponse = {
      reservation: { ...reservationResponse, lateCheckoutApprovedUntil: '14:00' },
      room: { id: 'room-id' },
    };

    reservationWorkflowService.approveLateCheckout.mockResolvedValue(workflowResponse);

    await expect(
      controller.approveLateCheckout(propertyId, reservationId, { approvedUntil: '14:00', notes: 'Late flight' }),
    ).resolves.toEqual(workflowResponse);

    expect(reservationWorkflowService.approveLateCheckout).toHaveBeenCalledWith(
      propertyId,
      reservationId,
      { approvedUntil: '14:00', notes: 'Late flight' },
      { actorId: null },
    );
  });

  it('queues booking confirmation after successful reservation confirmation', async () => {
    reservationWorkflowService.confirm.mockResolvedValue(reservationEntity);

    await expect(controller.confirm(propertyId, reservationId)).resolves.toEqual(
      reservationResponse,
    );

    expect(reservationWorkflowService.confirm).toHaveBeenCalledWith(propertyId, reservationId, {
      actorId: null,
    });

    expect(bookingConfirmationEmailService.queueAutomatic).toHaveBeenCalledWith(
      propertyId,
      reservationId,
    );
  });

  it('does not fail reservation confirmation when email queueing fails', async () => {
    reservationWorkflowService.confirm.mockResolvedValue(reservationEntity);
    bookingConfirmationEmailService.queueAutomatic.mockRejectedValue(
      new Error('Email infrastructure unavailable'),
    );

    await expect(controller.confirm(propertyId, reservationId)).resolves.toEqual(
      reservationResponse,
    );
  });

  it('queues an intentional booking confirmation resend', async () => {
    await expect(controller.resendConfirmationEmail(propertyId, reservationId)).resolves.toEqual({
      success: true,
      queued: true,
      message: 'Booking confirmation email queued.',
    });

    expect(bookingConfirmationEmailService.resend).toHaveBeenCalledWith(propertyId, reservationId);
  });

  it('returns a simple no-email message when resend cannot be queued', async () => {
    bookingConfirmationEmailService.resend.mockResolvedValue({
      queued: false,
      reason: 'NO_GUEST_EMAIL',
    });

    await expect(controller.resendConfirmationEmail(propertyId, reservationId)).resolves.toEqual({
      success: true,
      queued: false,
      message: 'Guest email is not available.',
    });
  });

  it('queues checkout invoice email after successful checkout', async () => {
    const workflowResponse = {
      reservation: {
        ...reservationResponse,
        status: ReservationStatus.CHECKED_OUT,
      },
      room: {
        id: 'room-id',
        status: 'NEEDS_CLEANING',
      },
    };

    reservationWorkflowService.checkOut.mockResolvedValue(workflowResponse);

    await expect(
      controller.checkOut(propertyId, reservationId, { lateCheckout: false }),
    ).resolves.toEqual(workflowResponse);

    expect(reservationWorkflowService.checkOut).toHaveBeenCalledWith(
      propertyId,
      reservationId,
      { actorId: null },
      { lateCheckout: false },
    );

    expect(checkoutInvoiceEmailService.queueAutomatic).toHaveBeenCalledWith(
      propertyId,
      reservationId,
    );
  });

  it('does not fail checkout when final invoice email queueing fails', async () => {
    const workflowResponse = {
      reservation: {
        ...reservationResponse,
        status: ReservationStatus.CHECKED_OUT,
      },
      room: {
        id: 'room-id',
        status: 'NEEDS_CLEANING',
      },
    };

    reservationWorkflowService.checkOut.mockResolvedValue(workflowResponse);
    checkoutInvoiceEmailService.queueAutomatic.mockRejectedValue(
      new Error('Email infrastructure unavailable'),
    );

    await expect(
      controller.checkOut(propertyId, reservationId, { lateCheckout: false }),
    ).resolves.toEqual(workflowResponse);

    expect(checkoutInvoiceEmailService.queueAutomatic).toHaveBeenCalledWith(
      propertyId,
      reservationId,
    );
  });

  it('queues an intentional final invoice email resend', async () => {
    await expect(controller.resendFinalInvoiceEmail(propertyId, reservationId)).resolves.toEqual({
      success: true,
      queued: true,
      message: 'Final invoice email queued.',
    });

    expect(checkoutInvoiceEmailService.resend).toHaveBeenCalledWith(propertyId, reservationId);
  });

  it('returns a useful message when final invoice resend cannot be queued', async () => {
    checkoutInvoiceEmailService.resend.mockResolvedValue({
      queued: false,
      reason: 'NO_FINALIZED_INVOICE',
    });

    await expect(controller.resendFinalInvoiceEmail(propertyId, reservationId)).resolves.toEqual({
      success: true,
      queued: false,
      message: 'A finalized tax invoice is not available yet.',
    });
  });
});
