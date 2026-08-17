import { BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository, DataSource } from 'typeorm';
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
import { GuestDocumentEntity } from './check-in-capture/guest-document.entity';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { ReservationsService } from './reservations.service';
import { ChildPricingService } from '../rates/child-pricing.service';
import { AvailabilityService } from '../inventory/availability.service';
import { ReservationPricingService } from './services/reservation-pricing.service';
import { ReservationRateSnapshotService } from './services/reservation-rate-snapshot.service';
import { RestrictionService } from '../rates/restriction.service';

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
  childAges: null,
  roomTypeId,
  roomType: roomTypeEntity,
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

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let guestsRepository: MockRepository<GuestEntity>;
  let roomTypesRepository: MockRepository<RoomTypeEntity>;
  let roomsRepository: MockRepository<RoomEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;
  let guestDocumentsRepository: MockRepository<GuestDocumentEntity>;
  const propertiesService = { findOne: jest.fn() };
  const childPricingService = { validateReservationChildAges: jest.fn() };
  const availabilityService = { reserve: jest.fn(), restore: jest.fn(), applyDelta: jest.fn(), read: jest.fn() };
  const reservationPricingService = {
    buildCommercialSnapshot: jest.fn(),
    resolveEffectiveRatePlanId: jest.fn().mockResolvedValue(null),
  };
  const restrictionService = {
    assertStaySellable: jest.fn().mockResolvedValue(undefined),
    assertAmendmentSellable: jest.fn().mockResolvedValue(undefined),
  };
  const reservationRateSnapshotService = {
    computeCommercialHash: jest.fn(
      (key: Record<string, unknown>) =>
        `${key.ratePlanId ?? 'NONE'}|${key.roomTypeId}|${key.arrivalDate}|${key.departureDate}|${key.adults}|${[...((key.childAges as number[]) ?? [])].sort((a, b) => a - b).join(',')}`,
    ),
    recordInitialVersion: jest.fn(async (_m: unknown, reservation: Record<string, unknown>, key: Record<string, unknown>) => {
      const c = await reservationPricingService.buildCommercialSnapshot({ ...key });
      reservation.ratePlanId = c.ratePlanId;
      reservation.rateSnapshot = c.rateSnapshot;
      reservation.rateSnapshotVersion = 1;
    }),
    amend: jest.fn(async (_m: unknown, reservation: Record<string, unknown>, key: Record<string, unknown>) => {
      const c = await reservationPricingService.buildCommercialSnapshot({ ...key });
      reservation.ratePlanId = c.ratePlanId;
      reservation.rateSnapshot = c.rateSnapshot;
      const v = ((reservation.rateSnapshotVersion as number) ?? 1) + 1;
      reservation.rateSnapshotVersion = v;
      return { changed: true, version: v };
    }),
  };
  let dataSource: { transaction: jest.Mock; query: jest.Mock };

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
    guestDocumentsRepository = { find: jest.fn().mockResolvedValue([]) };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });
    childPricingService.validateReservationChildAges.mockResolvedValue(undefined);
    availabilityService.reserve.mockResolvedValue([]);
    availabilityService.applyDelta.mockResolvedValue(undefined);
    reservationPricingService.buildCommercialSnapshot.mockResolvedValue({
      ratePlanId: null,
      rateSnapshot: { version: 1, pricingStatus: 'UNPRICED', reason: 'NO_APPLICABLE_RATE_PLAN' },
    });

    // Fake transaction: runs the callback with a manager whose getRepository
    // returns the mocked reservations repository (mirrors real behaviour).
    // dataSource.query() mocks the atomic per-property reservation-code counter
    // (allocated in its own auto-committed statement before the transaction).
    const fakeManager = {
      getRepository: jest.fn().mockReturnValue(reservationsRepository),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(fakeManager)),
      query: jest.fn().mockResolvedValue([{ last_value: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: getRepositoryToken(ReservationEntity), useValue: reservationsRepository },
        { provide: getRepositoryToken(GuestEntity), useValue: guestsRepository },
        { provide: getRepositoryToken(RoomTypeEntity), useValue: roomTypesRepository },
        { provide: getRepositoryToken(RoomEntity), useValue: roomsRepository },
        { provide: getRepositoryToken(ActivityEventEntity), useValue: activityRepository },
        { provide: getRepositoryToken(GuestDocumentEntity), useValue: guestDocumentsRepository },
        { provide: PropertiesService, useValue: propertiesService },
        { provide: ChildPricingService, useValue: childPricingService },
        { provide: DataSource, useValue: dataSource },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: ReservationPricingService, useValue: reservationPricingService },
        { provide: ReservationRateSnapshotService, useValue: reservationRateSnapshotService },
        { provide: RestrictionService, useValue: restrictionService },
      ],
    }).compile();

    service = module.get(ReservationsService);
  });

  it('creates a reservation when guest, room type, and room belong to the property', async () => {
    reservationsRepository.create?.mockReturnValue({ ...reservationEntity, roomId });
    reservationsRepository.save?.mockResolvedValue({ ...reservationEntity, roomId });
    reservationsRepository.count?.mockResolvedValue(0);

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
        roomId,
      }),
    ).resolves.toEqual({
      ...reservationEntity,
      roomId,
      ratePlanId: null,
      rateSnapshot: { version: 1, pricingStatus: 'UNPRICED', reason: 'NO_APPLICABLE_RATE_PLAN' },
      rateSnapshotVersion: 1,
    });
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
        childAges: null,
      }),
    );
  });

  it('defaults source to FRONT_DESK when omitted and accepts a canonical CHANNEL source', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);

    await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
    });
    expect(reservationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: ReservationSource.FRONT_DESK }),
    );

    reservationsRepository.create?.mockClear();
    await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
      source: ReservationSource.CHANNEL,
    });
    expect(reservationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: ReservationSource.CHANNEL }),
    );
  });


  it('reserves exactly one inventory unit per stay night when creating a consuming reservation', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);

    await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
      status: ReservationStatus.PENDING,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(availabilityService.reserve).toHaveBeenCalledTimes(1);
    expect(availabilityService.reserve).toHaveBeenCalledWith(
      { propertyId, roomTypeId, nights: ['2026-07-15', '2026-07-16'], units: 1 },
      expect.anything(),
    );
  });

  it('does NOT reserve inventory when creating directly into a non-consuming status', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);

    await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
      status: ReservationStatus.CANCELLED,
    });

    expect(availabilityService.reserve).not.toHaveBeenCalled();
  });

  describe('external identity idempotency (1C-d2)', () => {
    const extDto = (over: Partial<Record<string, unknown>> = {}) => ({
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
      status: ReservationStatus.CONFIRMED,
      sourceProvider: 'BOOKING_COM',
      externalReservationId: 'EXT-1',
      source: ReservationSource.CHANNEL,
      ...over,
    });
    const existingExt = () => ({
      ...reservationEntity,
      source: ReservationSource.CHANNEL,
      sourceProvider: 'BOOKING_COM',
      externalReservationId: 'EXT-1',
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      children: 0,
      childAges: null,
      ratePlanId: null,
    });

    beforeEach(() => {
      reservationsRepository.create?.mockImplementation((input) => input);
      reservationsRepository.save?.mockImplementation(async (input) => input);
    });

    it('creates normally when no prior external identity exists, scoping the lookup by property+provider+externalReservationId', async () => {
      reservationsRepository.findOne?.mockResolvedValue(null);
      await service.create(propertyId, extDto() as never);
      expect(reservationsRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId, sourceProvider: 'BOOKING_COM', externalReservationId: 'EXT-1' },
        }),
      );
      expect(reservationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceProvider: 'BOOKING_COM', externalReservationId: 'EXT-1' }),
      );
      expect(availabilityService.reserve).toHaveBeenCalledTimes(1);
    });

    it('normalizes a lower-case provider before lookup and persistence', async () => {
      reservationsRepository.findOne?.mockResolvedValue(null);
      await service.create(propertyId, extDto({ sourceProvider: ' booking_com ' }) as never);
      expect(reservationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceProvider: 'BOOKING_COM' }),
      );
    });

    it('requires sourceProvider when externalReservationId is supplied', async () => {
      await expect(
        service.create(propertyId, extDto({ sourceProvider: undefined }) as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('returns the existing reservation on an equivalent retry with NO create/inventory/snapshot side effects', async () => {
      const existing = existingExt();
      reservationsRepository.findOne?.mockResolvedValue(existing);
      const result = await service.create(propertyId, extDto({ sourceProvider: 'booking_com' }) as never);
      expect(result).toBe(existing);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(reservationsRepository.create).not.toHaveBeenCalled();
      expect(availabilityService.reserve).not.toHaveBeenCalled();
      expect(reservationRateSnapshotService.recordInitialVersion).not.toHaveBeenCalled();
    });

    it('rejects a conflicting retry (same external identity, different material data) with 409 EXTERNAL_RESERVATION_CONFLICT', async () => {
      reservationsRepository.findOne?.mockResolvedValue({ ...existingExt(), departureDate: '2026-07-20' });
      const err = await service.create(propertyId, extDto() as never).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code: 'EXTERNAL_RESERVATION_CONFLICT' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(reservationsRepository.create).not.toHaveBeenCalled();
    });

    it('converges concurrent duplicates to one reservation when the unique index rejects the loser', async () => {
      const winner = existingExt();
      // pre-check: none yet; then recovery + re-fetch after the unique violation: winner.
      reservationsRepository.findOne
        ?.mockResolvedValueOnce(null)
        .mockResolvedValue(winner);
      dataSource.transaction.mockImplementationOnce(async () => {
        throw new QueryFailedError(
          'INSERT',
          [],
          { code: '23505', constraint: 'UQ_reservations_external_identity' } as never,
        );
      });

      const result = await service.create(propertyId, extDto() as never);
      expect(result).toBe(winner);
      expect(availabilityService.reserve).not.toHaveBeenCalled();
    });
  });


  describe('restriction validation on create (1C-c2)', () => {
    const clearDto = (status: ReservationStatus, ratePlanId?: string) => ({
      guestId, arrivalDate: '2026-07-15', departureDate: '2026-07-17', adults: 2, roomTypeId, ratePlanId, status,
    });

    beforeEach(() => {
      reservationsRepository.create?.mockImplementation((input) => input);
      reservationsRepository.save?.mockImplementation(async (input) => input);
    });

    it('allows a clear PENDING create (assertStaySellable resolves)', async () => {
      await expect(service.create(propertyId, clearDto(ReservationStatus.PENDING))).resolves.toBeDefined();
      expect(restrictionService.assertStaySellable).toHaveBeenCalledTimes(1);
      expect(availabilityService.reserve).toHaveBeenCalledTimes(1);
    });

    it('allows a clear direct-CONFIRMED create', async () => {
      await expect(service.create(propertyId, clearDto(ReservationStatus.CONFIRMED))).resolves.toBeDefined();
      expect(restrictionService.assertStaySellable).toHaveBeenCalledTimes(1);
      expect(reservationRateSnapshotService.recordInitialVersion).toHaveBeenCalledTimes(1);
    });

    it('propagates RESTRICTION_VIOLATION (422) and leaves NO reservation/inventory/snapshot side effects', async () => {
      restrictionService.assertStaySellable.mockRejectedValueOnce(
        new HttpException({ code: 'RESTRICTION_VIOLATION', message: 'blocked', violations: [{ type: 'STOP_SELL' }, { type: 'MIN_STAY' }] }, HttpStatus.UNPROCESSABLE_ENTITY),
      );

      const err = await service.create(propertyId, clearDto(ReservationStatus.CONFIRMED)).catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(422);
      expect(err.getResponse()).toMatchObject({ code: 'RESTRICTION_VIOLATION', violations: expect.arrayContaining([{ type: 'STOP_SELL' }, { type: 'MIN_STAY' }]) });
      // validation runs before any write => nothing persisted
      expect(reservationsRepository.save).not.toHaveBeenCalled();
      expect(availabilityService.reserve).not.toHaveBeenCalled();
      expect(reservationRateSnapshotService.recordInitialVersion).not.toHaveBeenCalled();
    });

    it('validates using the EXPLICIT rate plan when supplied', async () => {
      reservationPricingService.resolveEffectiveRatePlanId.mockResolvedValueOnce('rp-explicit');
      await service.create(propertyId, clearDto(ReservationStatus.PENDING, 'rp-explicit'));
      expect(reservationPricingService.resolveEffectiveRatePlanId).toHaveBeenCalledWith({ propertyId, roomTypeId, ratePlanId: 'rp-explicit' }, expect.anything());
      expect(restrictionService.assertStaySellable).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId, roomTypeId, ratePlanId: 'rp-explicit', arrivalDate: '2026-07-15', departureDate: '2026-07-17' }),
        expect.anything(),
      );
    });

    it('validates using the property DEFAULT rate plan when ratePlanId is omitted', async () => {
      reservationPricingService.resolveEffectiveRatePlanId.mockResolvedValueOnce('rp-default');
      await service.create(propertyId, clearDto(ReservationStatus.PENDING));
      expect(reservationPricingService.resolveEffectiveRatePlanId).toHaveBeenCalledWith({ propertyId, roomTypeId, ratePlanId: null }, expect.anything());
      expect(restrictionService.assertStaySellable).toHaveBeenCalledWith(expect.objectContaining({ ratePlanId: 'rp-default' }), expect.anything());
    });

    it('falls back to roomType baseline (ratePlanId null) when no plan/default exists', async () => {
      reservationPricingService.resolveEffectiveRatePlanId.mockResolvedValueOnce(null);
      await service.create(propertyId, clearDto(ReservationStatus.PENDING));
      expect(restrictionService.assertStaySellable).toHaveBeenCalledWith(expect.objectContaining({ ratePlanId: null }), expect.anything());
    });
  });

  it('rolls back the reservation when inventory is insufficient (transactional)', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);
    availabilityService.reserve.mockRejectedValueOnce(
      new ConflictException({ code: 'INVENTORY_UNAVAILABLE', message: 'no room' }),
    );

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        roomTypeId,
        status: ReservationStatus.CONFIRMED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // reserve was attempted inside the same transaction that saved the reservation;
    // the rejection propagates out of dataSource.transaction, rolling everything back.
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(availabilityService.reserve).toHaveBeenCalledTimes(1);
  });

  it('snapshots pricing on direct CONFIRMED create', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);
    reservationPricingService.buildCommercialSnapshot.mockResolvedValueOnce({
      ratePlanId: 'rp-1',
      rateSnapshot: { version: 1, pricingStatus: 'PRICED', totals: { grandTotal: '10000.00' } },
    });

    const created = await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
      status: ReservationStatus.CONFIRMED,
    });

    expect(reservationPricingService.buildCommercialSnapshot).toHaveBeenCalledTimes(1);
    expect(created).toMatchObject({
      ratePlanId: 'rp-1',
      rateSnapshot: { pricingStatus: 'PRICED' },
    });
  });

  it('does NOT snapshot pricing on PENDING create (unsnapshotted until confirm)', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);

    const created = await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      roomTypeId,
      status: ReservationStatus.PENDING,
    });

    expect(reservationPricingService.buildCommercialSnapshot).not.toHaveBeenCalled();
    expect(created.rateSnapshot).toBeNull();
  });

  it('persists child ages when children are selected', async () => {
    reservationsRepository.create?.mockImplementation((input) => input);
    reservationsRepository.save?.mockImplementation(async (input) => input);
    reservationsRepository.count?.mockResolvedValue(0);

    await service.create(propertyId, {
      guestId,
      arrivalDate: '2026-07-15',
      departureDate: '2026-07-17',
      adults: 2,
      children: 1,
      childAges: [4],
      roomTypeId,
    });

    expect(childPricingService.validateReservationChildAges).toHaveBeenCalledWith(propertyId, 1, [
      4,
    ]);
    expect(reservationsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ children: 1, childAges: [4] }),
    );
  });

  it('rejects malformed child ages from backend validation', async () => {
    childPricingService.validateReservationChildAges.mockRejectedValue(
      new BadRequestException('Child ages must match the selected child count'),
    );

    await expect(
      service.create(propertyId, {
        guestId,
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        adults: 2,
        children: 2,
        childAges: [4],
        roomTypeId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reservationsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects direct room assignment when an active overlapping reservation already has the room', async () => {
    reservationsRepository.count
      ?.mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

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
    expect(reservationsRepository.save).not.toHaveBeenCalled();
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
      leftJoinAndSelect: jest.fn().mockReturnThis(),
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
      leftJoinAndSelect: jest.fn().mockReturnThis(),
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

  it('updates a reservation and re-fetches the persisted state', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservationEntity);
    reservationsRepository.merge?.mockImplementation((reservation, update) => ({
      ...reservation,
      ...update,
    }));
    reservationsRepository.save?.mockImplementation(async (reservation) => reservation);

    await expect(
      service.update(propertyId, reservationId, {
        roomId,
      }),
    ).resolves.toEqual(reservationEntity);
    // scalar FK and relation are aligned before save so the write is reliable
    expect(reservationsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ roomId }),
    );
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
        notes: 'Updated',
        reservationCode: 'CLIENT-SUPPLIED-CODE',
      } as never),
    ).resolves.toEqual(reservationEntity);
    expect(reservationsRepository.merge).toHaveBeenCalledWith(
      reservationEntity,
      expect.not.objectContaining({ reservationCode: expect.any(String) }),
    );
  });

  it('validates restrictions on a commercial amendment (date change) and skips them for operational edits', async () => {
    const res = { ...reservationEntity, arrivalDate: '2026-07-10', departureDate: '2026-07-12', status: ReservationStatus.CONFIRMED, rateSnapshotVersion: 1 };
    reservationsRepository.merge?.mockImplementation((r, u) => ({ ...r, ...u }));
    reservationsRepository.save?.mockImplementation(async (r) => r);

    // commercial (date) change -> change-aware restriction validation runs
    reservationsRepository.findOne?.mockResolvedValue(res);
    await service.update(propertyId, reservationId, { departureDate: '2026-07-14' });
    expect(restrictionService.assertAmendmentSellable).toHaveBeenCalledTimes(1);

    // operational-only edit -> no restriction validation
    restrictionService.assertAmendmentSellable.mockClear();
    reservationsRepository.findOne?.mockResolvedValue(res);
    await service.update(propertyId, reservationId, { notes: 'front desk note' });
    expect(restrictionService.assertAmendmentSellable).not.toHaveBeenCalled();
  });

  it('propagates a RESTRICTION_VIOLATION from a commercial amendment (rollback, no amend)', async () => {
    const res = { ...reservationEntity, arrivalDate: '2026-07-10', departureDate: '2026-07-12', status: ReservationStatus.CONFIRMED, rateSnapshotVersion: 1 };
    reservationsRepository.findOne?.mockResolvedValue(res);
    reservationsRepository.merge?.mockImplementation((r, u) => ({ ...r, ...u }));
    reservationsRepository.save?.mockImplementation(async (r) => r);
    restrictionService.assertAmendmentSellable.mockRejectedValueOnce(
      new HttpException({ code: 'RESTRICTION_VIOLATION', details: [{ field: 'STOP_SELL' }] }, HttpStatus.UNPROCESSABLE_ENTITY),
    );

    const err = await service.update(propertyId, reservationId, { departureDate: '2026-07-14' }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(422);
    expect(reservationRateSnapshotService.amend).not.toHaveBeenCalled();
  });

  it('validates restrictions on a PENDING commercial amendment even without an existing snapshot version (no amend)', async () => {
    const res = {
      ...reservationEntity,
      arrivalDate: '2026-07-10',
      departureDate: '2026-07-12',
      status: ReservationStatus.PENDING,
      rateSnapshotVersion: null,
    };
    reservationsRepository.findOne?.mockResolvedValue(res);
    reservationsRepository.merge?.mockImplementation((r, u) => ({ ...r, ...u }));
    reservationsRepository.save?.mockImplementation(async (r) => r);

    await service.update(propertyId, reservationId, { departureDate: '2026-07-14' });

    // restriction gate fires on PENDING (grandfathering) but no snapshot amend
    // happens because PENDING has no ACTIVE snapshot yet (deferred to confirm).
    expect(restrictionService.assertAmendmentSellable).toHaveBeenCalledTimes(1);
    expect(reservationRateSnapshotService.amend).not.toHaveBeenCalled();
  });

  describe('externalConfirmationId write-once (1C-d3)', () => {
    const baseRes = (over = {}) => ({
      ...reservationEntity,
      status: ReservationStatus.CONFIRMED,
      arrivalDate: '2026-07-10',
      departureDate: '2026-07-12',
      ...over,
    });

    beforeEach(() => {
      reservationsRepository.merge?.mockImplementation((r, u) => ({ ...r, ...u }));
      reservationsRepository.save?.mockImplementation(async (r) => r);
    });

    it('attaches externalConfirmationId when currently NULL (operational, no restriction/amend)', async () => {
      reservationsRepository.findOne?.mockResolvedValue(baseRes({ externalConfirmationId: null }));
      await service.update(propertyId, reservationId, { externalConfirmationId: 'CONF-1' });
      expect(reservationsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ externalConfirmationId: 'CONF-1' }),
      );
      expect(restrictionService.assertAmendmentSellable).not.toHaveBeenCalled();
      expect(reservationRateSnapshotService.amend).not.toHaveBeenCalled();
    });

    it('accepts an idempotent retry with the SAME confirmation value (no error)', async () => {
      reservationsRepository.findOne?.mockResolvedValue(baseRes({ externalConfirmationId: 'CONF-1' }));
      await expect(
        service.update(propertyId, reservationId, { externalConfirmationId: 'CONF-1' }),
      ).resolves.toBeDefined();
    });

    it('rejects CHANGING an already-set confirmation value with 409 EXTERNAL_CONFIRMATION_IMMUTABLE', async () => {
      reservationsRepository.findOne?.mockResolvedValue(baseRes({ externalConfirmationId: 'CONF-1' }));
      const err = await service
        .update(propertyId, reservationId, { externalConfirmationId: 'CONF-2' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code: 'EXTERNAL_CONFIRMATION_IMMUTABLE' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects CLEARING an already-set confirmation value (null) with 409', async () => {
      reservationsRepository.findOne?.mockResolvedValue(baseRes({ externalConfirmationId: 'CONF-1' }));
      const err = await service
        .update(propertyId, reservationId, { externalConfirmationId: null } as never)
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });




  it('gets a reservation by id within the property', async () => {
    reservationsRepository.findOne?.mockResolvedValue(reservationEntity);

    await expect(service.findOne(propertyId, reservationId)).resolves.toEqual(reservationEntity);
    expect(reservationsRepository.findOne).toHaveBeenCalledWith({
      where: { id: reservationId, propertyId },
      relations: { guest: true, roomType: true, room: true },
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
