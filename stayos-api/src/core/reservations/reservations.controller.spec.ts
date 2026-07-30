import { Test, TestingModule } from '@nestjs/testing';
import { ReservationPaymentStatus } from './domain/reservation-payment-status.enum';
import { ReservationSource } from './domain/reservation-source.enum';
import { ReservationStatus } from './domain/reservation-status.enum';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './services/check-in.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';

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
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};
const reservationResponse = {
  id: reservationId,
  propertyId,
  guestId,
  reservationCode: 'RSV-HILL-0001',
  arrivalDate: '2026-07-15',
  departureDate: '2026-07-17',
  adults: 2,
  children: 0,
  roomTypeId,
  roomId: null,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

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
    checkIn: jest.fn(),
    checkOut: jest.fn(),
  };
  const checkInService = {
    getWorkspace: jest.fn(),
    updateGuestRegistration: jest.fn(),
    updateIdentity: jest.fn(),
    reviewPayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: ReservationsService, useValue: reservationsService },
        { provide: ReservationWorkflowService, useValue: reservationWorkflowService },
        { provide: CheckInService, useValue: checkInService },
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

  it('delegates create requests to the service', async () => {
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
  });

  it('delegates get-by-id requests to the service', async () => {
    reservationsService.findOne.mockResolvedValue(reservationEntity);

    await expect(controller.findOne(propertyId, reservationId)).resolves.toEqual(
      reservationResponse,
    );
    expect(reservationsService.findOne).toHaveBeenCalledWith(propertyId, reservationId);
  });

  it('delegates update requests to the service', async () => {
    reservationsService.update.mockResolvedValue({
      ...reservationEntity,
      status: ReservationStatus.CHECKED_IN,
    });

    await expect(
      controller.update(propertyId, reservationId, { status: ReservationStatus.CHECKED_IN }),
    ).resolves.toEqual({
      ...reservationResponse,
      status: ReservationStatus.CHECKED_IN,
    });
    expect(reservationsService.update).toHaveBeenCalledWith(propertyId, reservationId, {
      status: ReservationStatus.CHECKED_IN,
    });
  });

  it('delegates assign-room workflow requests', async () => {
    const workflowResponse = { reservation: reservationResponse, room: { id: 'room-id' } };
    reservationWorkflowService.assignRoom.mockResolvedValue(workflowResponse);

    await expect(
      controller.assignRoom(propertyId, reservationId, { roomId: 'room-id' }),
    ).resolves.toEqual(workflowResponse);
    expect(reservationWorkflowService.assignRoom).toHaveBeenCalledWith(
      propertyId,
      reservationId,
      {
        roomId: 'room-id',
      },
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
});
