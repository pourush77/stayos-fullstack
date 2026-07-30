import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { GuestStatus } from '../guests/domain/guest-status.enum';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypeStatus } from '../room-types/domain/room-type-status.enum';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../rooms/domain/room-status.enum';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { ReservationPaymentStatus } from './domain/reservation-payment-status.enum';
import { ReservationSource } from './domain/reservation-source.enum';
import { ReservationStatus } from './domain/reservation-status.enum';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationsService } from './reservations.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomTypeId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const guestEntity: GuestEntity = {
  id: guestId,
  propertyId,
  property: undefined as never,
  firstName: 'Ananya',
  lastName: 'Rao',
  displayName: 'Ananya Rao',
  phone: '9876522110',
  alternatePhone: null,
  email: 'ananya.rao@example.com',
  gender: 'Female',
  dateOfBirth: null,
  anniversaryDate: null,
  nationality: 'Indian',
  preferredLanguage: 'English',
  companyName: null,
  gstNumber: null,
  vipStatus: true,
  blacklistStatus: false,
  notes: null,
  status: GuestStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};
const roomTypeEntity: RoomTypeEntity = {
  id: roomTypeId,
  propertyId,
  property: undefined as never,
  code: 'DLX',
  name: 'Deluxe',
  description: null,
  baseOccupancy: 2,
  maxOccupancy: 3,
  maxAdults: 2,
  maxChildren: 1,
  bedType: 'King',
  sizeSqFt: 251,
  status: RoomTypeStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};
const roomEntity: RoomEntity = {
  id: roomId,
  propertyId,
  property: undefined as never,
  floorId: 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676',
  floor: undefined as never,
  roomTypeId,
  roomType: undefined as never,
  roomNumber: '201',
  displayName: '201',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: RoomOperationalStatus.READY,
  operationalStatusReason: null,
  operationalStatusNote: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};
const reservationEntity: ReservationEntity = {
  id: reservationId,
  propertyId,
  property: undefined as never,
  guestId,
  guest: guestEntity,
  reservationCode: 'HS260705-00001',
  arrivalDate: '2026-07-15',
  departureDate: '2026-07-17',
  adults: 2,
  children: 0,
  roomTypeId,
  roomType: roomTypeEntity,
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

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let guestsRepository: MockRepository<GuestEntity>;
  let roomTypesRepository: MockRepository<RoomTypeEntity>;
  let roomsRepository: MockRepository<RoomEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;
  const propertiesService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    reservationsRepository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      merge: jest.fn(),
      save: jest.fn(),
    };
    guestsRepository = { findOne: jest.fn().mockResolvedValue(guestEntity) };
    roomTypesRepository = { findOne: jest.fn().mockResolvedValue(roomTypeEntity) };
    roomsRepository = { findOne: jest.fn().mockResolvedValue(roomEntity) };
    activityRepository = { find: jest.fn().mockResolvedValue([]) };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: getRepositoryToken(ReservationEntity), useValue: reservationsRepository },
        { provide: getRepositoryToken(GuestEntity), useValue: guestsRepository },
        { provide: getRepositoryToken(RoomTypeEntity), useValue: roomTypesRepository },
        { provide: getRepositoryToken(RoomEntity), useValue: roomsRepository },
        { provide: getRepositoryToken(ActivityEventEntity), useValue: activityRepository },
        { provide: PropertiesService, useValue: propertiesService },
      ],
    }).compile();

    service = module.get(ReservationsService);
  });

  it('creates a reservation when guest, room type, and room belong to the property', async () => {
    reservationsRepository.create?.mockReturnValue({ ...reservationEntity, roomId });
    reservationsRepository.save?.mockResolvedValue({ ...reservationEntity, roomId });

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
        roomId,
      }),
    ).resolves.toEqual({ ...reservationEntity, roomId });
    expect(reservationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId,
        guestId,
        reservationCode: expect.stringMatching(/^HS\d{6}-\d{5}$/),
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
        roomId,
      }),
    );
  });

  it('rejects departure dates that are not after arrival dates', async () => {
    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-17',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects guests from another property', async () => {
    guestsRepository.findOne?.mockResolvedValue({ ...guestEntity, propertyId: otherPropertyId });

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects room types from another property', async () => {
    roomTypesRepository.findOne?.mockResolvedValue({
      ...roomTypeEntity,
      propertyId: otherPropertyId,
    });

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects assigned rooms from another property', async () => {
    roomsRepository.findOne?.mockResolvedValue({ ...roomEntity, propertyId: otherPropertyId });

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
        roomId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists reservations with pagination', async () => {
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[reservationEntity], 1]),
    };
    reservationsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await expect(
      service.findAll(propertyId, { page: 1, limit: 20, sortOrder: 'ASC' }),
    ).resolves.toEqual({
      data: [reservationEntity],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('reservation.arrivalDate', 'ASC');
  });

  it('searches by reservation code, guest name, and phone', async () => {
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([reservationEntity]),
    };
    reservationsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);

    await service.findAll(propertyId, { search: 'ananya', sortOrder: 'ASC' });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('guest.phone'), {
      search: '%ananya%',
    });
  });

  it('updates a reservation', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservationEntity);
    reservationsRepository.merge?.mockImplementation((reservation, update) => ({
      ...reservation,
      ...update,
    }));
    reservationsRepository.save?.mockImplementation(async (reservation) => reservation);

    await expect(
      service.update(propertyId, reservationId, {
        status: ReservationStatus.CHECKED_IN,
        roomId,
      }),
    ).resolves.toEqual({
      ...reservationEntity,
      status: ReservationStatus.CHECKED_IN,
      roomId,
    });
  });

  it('ignores reservation code changes during update', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservationEntity);
    reservationsRepository.merge?.mockImplementation((reservation, update) => ({
      ...reservation,
      ...update,
    }));
    reservationsRepository.save?.mockImplementation(async (reservation) => reservation);

    await expect(
      service.update(propertyId, reservationId, {
        status: ReservationStatus.CHECKED_IN,
        reservationCode: 'CLIENT-SUPPLIED-CODE',
      } as never),
    ).resolves.toEqual({
      ...reservationEntity,
      status: ReservationStatus.CHECKED_IN,
    });
    expect(reservationsRepository.merge).toHaveBeenCalledWith(
      reservationEntity,
      expect.not.objectContaining({ reservationCode: expect.any(String) }),
    );
  });

  it('gets a reservation by id within the property', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservationEntity);

    await expect(service.findOne(propertyId, reservationId)).resolves.toEqual(reservationEntity);
    expect(reservationsRepository.findOne).toHaveBeenCalledWith({
      where: { id: reservationId, propertyId },
    });
  });

  it('builds a stay workspace read model for a checked-in reservation', async () => {
    const activityCreatedAt = new Date('2026-07-16T09:30:00.000Z');
    reservationsRepository.findOne?.mockResolvedValue({
      ...reservationEntity,
      roomId,
      room: roomEntity,
      status: ReservationStatus.CHECKED_IN,
    });
    activityRepository.find?.mockResolvedValue([
      {
        id: 'a175c8fa-f36e-4f40-a3ef-2e9dbb1f0677',
        propertyId,
        type: 'CHECK_IN_COMPLETED',
        title: 'Checked in',
        description: 'Guest checked in',
        entityType: 'RESERVATION',
        entityId: reservationId,
        metadata: { source: 'front_desk' },
        createdAt: activityCreatedAt,
      },
    ]);

    await expect(service.getStayWorkspace(propertyId, reservationId)).resolves.toMatchObject({
      reservation: { id: reservationId, status: ReservationStatus.CHECKED_IN },
      guest: { id: guestId, displayName: 'Ananya Rao' },
      room: { id: roomId, roomNumber: '201' },
      activity: [
        {
          title: 'Checked in',
          timestamp: activityCreatedAt,
          entity: { type: 'RESERVATION', id: reservationId },
        },
      ],
      payment: { status: ReservationPaymentStatus.PAYMENT_DUE, reviewed: false },
      allowedActions: { canCheckOut: true, canExtendStay: true, canMoveRoom: true },
      warnings: expect.arrayContaining([expect.objectContaining({ type: 'PAYMENT_DUE' })]),
    });
    expect(reservationsRepository.findOne).toHaveBeenCalledWith({
      where: { id: reservationId, propertyId },
      relations: { guest: true, room: { floor: true, roomType: true }, roomType: true },
    });
    expect(activityRepository.find).toHaveBeenCalledWith({
      where: { propertyId, entityType: 'RESERVATION', entityId: reservationId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  });

  it('treats reservations from another property as not found', async () => {
    reservationsRepository.findOne?.mockResolvedValue(null);

    await expect(service.findOne(otherPropertyId, reservationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps duplicate reservation codes to conflicts', async () => {
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
    reservationsRepository.create?.mockReturnValue(reservationEntity);
    reservationsRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
