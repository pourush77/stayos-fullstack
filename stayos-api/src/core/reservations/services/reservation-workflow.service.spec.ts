import { BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { GuestStatus } from '../../guests/domain/guest-status.enum';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { RoomTypeStatus } from '../../room-types/domain/room-type-status.enum';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { FolioChargeEntity } from '../../billing/infrastructure/folio-charge.entity';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';
import { AccommodationPostingMode } from '../domain/accommodation-posting-mode.enum';
import { ReservationRateSnapshotTrigger } from '../domain/reservation-rate-snapshot-trigger.enum';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { CheckInService } from './check-in.service';
import { ReservationWorkflowService } from './reservation-workflow.service';
import { TaxService } from '../../rates/tax.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomTypeId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const otherRoomTypeId = '7175c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const targetRoomId = '8175c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const guestEntity = (): GuestEntity => ({
  id: guestId,
  propertyId,
  property: undefined as never,
  firstName: 'Rahul',
  lastName: 'Sharma',
  displayName: 'Rahul Sharma',
  phone: '9876500001',
  alternatePhone: null,
  email: null,
  gender: null,
  dateOfBirth: null,
  anniversaryDate: null,
  nationality: null,
  preferredLanguage: null,
  companyName: null,
  gstNumber: null,
  vipStatus: false,
  blacklistStatus: false,
  notes: null,
  status: GuestStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
});

const roomTypeEntity = (overrides: Partial<RoomTypeEntity> = {}): RoomTypeEntity => ({
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
  ...overrides,
});

const roomEntity = (overrides: Partial<RoomEntity> = {}): RoomEntity => ({
  id: roomId,
  propertyId,
  property: undefined as never,
  floorId: 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676',
  floor: undefined as never,
  roomTypeId,
  roomType: undefined as never,
  roomNumber: '204',
  displayName: '204',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: RoomOperationalStatus.READY,
  operationalStatusReason: null,
  operationalStatusNote: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const reservationEntity = (overrides: Partial<ReservationEntity> = {}): ReservationEntity => ({
  id: reservationId,
  propertyId,
  property: undefined as never,
  guestId,
  guest: undefined as never,
  reservationCode: 'RSV-001',
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
  accommodationPostingMode: AccommodationPostingMode.UPFRONT_FULL_STAY,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('ReservationWorkflowService', () => {
  let service: ReservationWorkflowService;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let roomsRepository: MockRepository<RoomEntity>;
  let roomTypesRepository: MockRepository<RoomTypeEntity>;
  let guestsRepository: MockRepository<GuestEntity>;
  let auditRepository: MockRepository<AuditEventEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;
  let foliosRepository: MockRepository<FolioEntity>;
  let folioChargesRepository: MockRepository<FolioChargeEntity>;
  let checkInService: Pick<CheckInService, 'loadWorkspaceParts' | 'validateFinalChecklist'>;
  let availabilityService: {
    reserve: jest.Mock;
    restore: jest.Mock;
    applyDelta: jest.Mock;
    read: jest.Mock;
  };
  let rateSnapshotService: {
    recordInitialVersion: jest.Mock;
    amend: jest.Mock;
    computeCommercialHash: jest.Mock;
  };
  let restrictionService: {
    assertAmendmentSellable: jest.Mock;
    assertStaySellable: jest.Mock;
  };
  let billingService: {
    reconcileRoomChargesOnManager: jest.Mock;
    reconcileAccommodationRoomChargesOnManager: jest.Mock;
    assertCommercialAmendmentAllowedOnManager: jest.Mock;
    assertNightlyAccommodationCompleteForCheckoutOnManager: jest.Mock;
  };

  beforeEach(() => {
    restrictionService = {
      assertAmendmentSellable: jest.fn().mockResolvedValue(undefined),
      assertStaySellable: jest.fn().mockResolvedValue(undefined),
    };
    billingService = {
      reconcileRoomChargesOnManager: jest.fn().mockResolvedValue(undefined),
      reconcileAccommodationRoomChargesOnManager: jest.fn().mockResolvedValue(undefined),
      assertCommercialAmendmentAllowedOnManager: jest.fn().mockResolvedValue(undefined),
      assertNightlyAccommodationCompleteForCheckoutOnManager: jest.fn().mockResolvedValue(undefined),
    };
    reservationsRepository = {
      findOne: jest.fn().mockResolvedValue(reservationEntity()),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation(async (entity: ReservationEntity) => entity),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    roomsRepository = {
      findOne: jest.fn().mockResolvedValue(roomEntity()),
      save: jest.fn().mockImplementation(async (entity: RoomEntity) => entity),
    };
    roomTypesRepository = {
      findOne: jest.fn().mockResolvedValue(roomTypeEntity()),
    };
    guestsRepository = {
      findOne: jest.fn().mockResolvedValue(guestEntity()),
    };
    auditRepository = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    activityRepository = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    foliosRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    folioChargesRepository = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const propertiesRepository = {
      findOne: jest.fn().mockResolvedValue({ id: propertyId, checkOutTime: '11:00:00' }),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ReservationEntity) return reservationsRepository;
        if (entity === RoomEntity) return roomsRepository;
        if (entity === RoomTypeEntity) return roomTypesRepository;
        if (entity === GuestEntity) return guestsRepository;
        if (entity === AuditEventEntity) return auditRepository;
        if (entity === ActivityEventEntity) return activityRepository;
        if (entity === FolioEntity) return foliosRepository;
        if (entity === FolioChargeEntity) return folioChargesRepository;
        if (entity === PropertyEntity) return propertiesRepository;
        throw new Error('Unexpected repository');
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource;

    checkInService = {
      loadWorkspaceParts: jest.fn(async () => ({
        reservation: await reservationsRepository.findOne?.(),
        guest: await guestsRepository.findOne?.(),
        room: await roomsRepository.findOne?.(),
        identity: { verified: true } as never,
      })),
      validateFinalChecklist: jest.fn((parts) => {
        if (parts.room?.operationalStatus !== RoomOperationalStatus.READY) {
          throw new BadRequestException();
        }
      }),
    };

    const taxService = {
      calculateForProperty: jest.fn(async (_propertyId: string, taxableAmount: number) => ({
        taxableSubtotal: taxableAmount.toFixed(2),
        taxAmount: (taxableAmount * 0.12).toFixed(2),
        total: (taxableAmount * 1.12).toFixed(2),
        taxName: 'GST',
        taxPercentage: '12.00',
        taxEnabled: true,
      })),
    };

    availabilityService = {
      reserve: jest.fn().mockResolvedValue([]),
      restore: jest.fn().mockResolvedValue([]),
      applyDelta: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue([]),
    };

    rateSnapshotService = {
      recordInitialVersion: jest.fn().mockResolvedValue(undefined),
      amend: jest.fn().mockResolvedValue({ changed: true, version: 2 }),
      computeCommercialHash: jest.fn().mockReturnValue('hash'),
    };

    service = new ReservationWorkflowService(
      dataSource,
      checkInService as CheckInService,
      taxService as unknown as TaxService,
      {
        resolveGroupDepositInput: jest.fn().mockResolvedValue({ type: 'NONE', value: 0 }),
      } as never,
      availabilityService as never,
      {
        buildCommercialSnapshot: jest
          .fn()
          .mockResolvedValue({ ratePlanId: null, rateSnapshot: { version: 1, pricingStatus: 'UNPRICED' } }),
      } as never,
      rateSnapshotService as never,
      billingService as never,
      restrictionService as never,
      { finalizeInvoiceOnManager: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  describe('assignRoom', () => {
    it('assigns ready matching room successfully', async () => {
      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).resolves.toMatchObject({
        reservation: { id: reservationId, roomId },
        room: { id: roomId, operationalStatus: RoomOperationalStatus.READY },
      });
      expect(auditRepository.save).toHaveBeenCalled();
      expect(activityRepository.save).toHaveBeenCalled();
    });

    it('rejects missing reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects missing room', async () => {
      roomsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects room from another property', async () => {
      roomsRepository.findOne?.mockResolvedValue(roomEntity({ propertyId: otherPropertyId }));

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects room type mismatch', async () => {
      roomsRepository.findOne?.mockResolvedValue(roomEntity({ roomTypeId: otherRoomTypeId }));

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects capacity mismatch', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ adults: 4 }));

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unavailable room', async () => {
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
      );

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects occupied room', async () => {
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects overlapping active assignment', async () => {
      reservationsRepository.count?.mockResolvedValue(1);

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('checkIn', () => {
    it('checks in confirmed reservation with ready assigned room', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await expect(service.checkIn(propertyId, reservationId)).resolves.toMatchObject({
        reservation: { id: reservationId, status: ReservationStatus.CHECKED_IN },
        room: { id: roomId, operationalStatus: RoomOperationalStatus.OCCUPIED },
      });
    });

    it('rejects pending reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.PENDING }),
      );

      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects cancelled reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CANCELLED }),
      );

      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects missing room assignment', async () => {
      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects non-ready room', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
      );

      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates room to occupied', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await service.checkIn(propertyId, reservationId);

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );
    });
  });

  describe('checkOut', () => {
    it('checks out checked-in reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await expect(service.checkOut(propertyId, reservationId)).resolves.toMatchObject({
        reservation: { id: reservationId, status: ReservationStatus.CHECKED_OUT },
      });
    });

    it('rejects reservation not checked in', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await expect(service.checkOut(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects checkout when the folio still has a balance', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      foliosRepository.findOne?.mockResolvedValue({
        id: 'folio-1',
        propertyId,
        reservationId,
        charges: [
          {
            type: FolioChargeType.ROOM,
            quantity: 1,
            unitAmount: '3500.00',
            amount: '3500.00',
            taxAmount: '420.00',
          },
        ],
        payments: [{ amount: '3500.00' }],
      } as FolioEntity);

      await expect(service.checkOut(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(roomsRepository.save).not.toHaveBeenCalled();
    });

    it('updates room to needs cleaning', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
      );
    });

    it('auto-settles a fully paid open folio during checkout', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      foliosRepository.findOne?.mockResolvedValue({
        id: 'folio-1',
        propertyId,
        reservationId,
        status: FolioStatus.OPEN,
        charges: [
          {
            type: FolioChargeType.ROOM,
            quantity: 1,
            unitAmount: '3500.00',
            amount: '3500.00',
            taxAmount: '420.00',
          },
        ],
        payments: [{ amount: '3920.00' }],
      } as FolioEntity);

      await service.checkOut(propertyId, reservationId);

      expect(foliosRepository.update).toHaveBeenCalledWith(
        { id: 'folio-1' },
        expect.objectContaining({
          status: FolioStatus.SETTLED,
          settledAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('creates audit event', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RESERVATION_CHECKED_OUT' }),
      );
    });

    it('creates activity event', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GUEST_CHECKED_OUT' }),
      );
    });

    it('V2.3F invokes the nightly accommodation completeness guard before settlement', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(
        billingService.assertNightlyAccommodationCompleteForCheckoutOnManager,
      ).toHaveBeenCalledWith(expect.anything(), propertyId, reservationId);
    });

    it('V2.3F blocks checkout (and skips lifecycle/settlement writes) when a required nightly night is missing', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      billingService.assertNightlyAccommodationCompleteForCheckoutOnManager.mockRejectedValueOnce(
        new ConflictException({
          code: 'NIGHTLY_ACCOMMODATION_NOT_READY_FOR_CHECKOUT',
          message: 'not ready',
          missingServiceDates: ['2026-08-05'],
        }),
      );

      const err = await service.checkOut(propertyId, reservationId).catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({
        code: 'NIGHTLY_ACCOMMODATION_NOT_READY_FOR_CHECKOUT',
      });
      // Guard runs before any settlement/lifecycle write.
      expect(foliosRepository.update).not.toHaveBeenCalled();
      expect(roomsRepository.save).not.toHaveBeenCalled();
      expect(reservationsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('extendStay', () => {
    it('re-prices via a new commercial snapshot version and posts no ad-hoc folio charge', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId,
          status: ReservationStatus.CHECKED_IN,
          paymentStatus: ReservationPaymentStatus.PAID,
        }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await expect(
        service.extendStay(propertyId, reservationId, { departureDate: '2026-07-18' }),
      ).resolves.toMatchObject({
        reservation: { id: reservationId, departureDate: '2026-07-18' },
      });

      // Authoritative re-pricing: a new snapshot version, NOT an ad-hoc folio charge.
      expect(rateSnapshotService.amend).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: reservationId, departureDate: '2026-07-18' }),
        expect.objectContaining({ departureDate: '2026-07-18' }),
        ReservationRateSnapshotTrigger.STAY_EXTENSION,
      );
      expect(folioChargesRepository.create).not.toHaveBeenCalled();
      expect(folioChargesRepository.save).not.toHaveBeenCalled();
      // A new ACTIVE snapshot version was created -> the OPEN folio's
      // snapshot-driven ROOM charges are auto-reconciled in the same txn.
      expect(billingService.reconcileAccommodationRoomChargesOnManager).toHaveBeenCalledTimes(1);
      expect(billingService.reconcileAccommodationRoomChargesOnManager).toHaveBeenCalledWith(
        expect.anything(),
        propertyId,
        reservationId,
      );
    });

    it('does NOT reconcile the folio when the extension re-price is a commercial no-op', async () => {
      rateSnapshotService.amend.mockResolvedValueOnce({ changed: false, version: 1 });
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await service.extendStay(propertyId, reservationId, { departureDate: '2026-07-18' });

      expect(rateSnapshotService.amend).toHaveBeenCalledTimes(1);
      expect(billingService.reconcileAccommodationRoomChargesOnManager).not.toHaveBeenCalled();
    });

    it('blocks the extension with a controlled 409 when the folio is settled (no amend, no reconcile)', async () => {
      billingService.assertCommercialAmendmentAllowedOnManager.mockRejectedValueOnce(
        new ConflictException({ code: 'FOLIO_SETTLED_AMENDMENT_BLOCKED', message: 'settled' }),
      );
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      const err = await service
        .extendStay(propertyId, reservationId, { departureDate: '2026-07-18' })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse().code).toBe('FOLIO_SETTLED_AMENDMENT_BLOCKED');
      // guard runs before amend -> neither snapshot version nor folio changes.
      expect(rateSnapshotService.amend).not.toHaveBeenCalled();
      expect(billingService.reconcileAccommodationRoomChargesOnManager).not.toHaveBeenCalled();
    });

    it('runs the change-aware restriction gate on the added nights + new departure', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await service.extendStay(propertyId, reservationId, { departureDate: '2026-07-18' });

      expect(restrictionService.assertAmendmentSellable).toHaveBeenCalledTimes(1);
      expect(restrictionService.assertAmendmentSellable).toHaveBeenCalledWith(
        expect.objectContaining({ departureDate: '2026-07-17' }),
        expect.objectContaining({ departureDate: '2026-07-18' }),
        expect.anything(),
      );
    });

    it('rolls back the extension when the restriction gate rejects the new nights', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );
      restrictionService.assertAmendmentSellable.mockRejectedValueOnce(
        new HttpException({ code: 'RESTRICTION_VIOLATION' }, HttpStatus.UNPROCESSABLE_ENTITY),
      );

      const err = await service
        .extendStay(propertyId, reservationId, { departureDate: '2026-07-18' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(422);
      // Gate runs BEFORE inventory delta + snapshot amend -> nothing committed.
      expect(availabilityService.applyDelta).not.toHaveBeenCalled();
      expect(rateSnapshotService.amend).not.toHaveBeenCalled();
      // Gate fails before amend -> no folio reconciliation.
      expect(billingService.reconcileAccommodationRoomChargesOnManager).not.toHaveBeenCalled();
    });

    it('rejects a departure date that is not later than the current departure', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await expect(
        service.extendStay(propertyId, reservationId, { departureDate: '2026-07-17' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('V2.3E1 NIGHTLY_V1: extends a checked-in stay without the full-stay reconcile block, creating a new snapshot and posting no folio charges', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId,
          status: ReservationStatus.CHECKED_IN,
          accommodationPostingMode: AccommodationPostingMode.NIGHTLY_V1,
        }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      // Previously this rolled back with NIGHTLY_POSTING_MODE_FULL_STAY_RECONCILE_BLOCKED.
      await expect(
        service.extendStay(propertyId, reservationId, { departureDate: '2026-07-18' }),
      ).resolves.toMatchObject({
        reservation: { id: reservationId, departureDate: '2026-07-18' },
      });

      // A new immutable snapshot version is created through the existing amend flow.
      expect(rateSnapshotService.amend).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: reservationId, departureDate: '2026-07-18' }),
        expect.objectContaining({ departureDate: '2026-07-18' }),
        ReservationRateSnapshotTrigger.STAY_EXTENSION,
      );
      // Extension routes through the mode-aware seam, NOT the legacy full-stay reconcile.
      expect(billingService.reconcileAccommodationRoomChargesOnManager).toHaveBeenCalledTimes(1);
      expect(billingService.reconcileRoomChargesOnManager).not.toHaveBeenCalled();
      // Extension itself posts/reverses NO folio ROOM charges (Night Audit is the poster).
      expect(folioChargesRepository.create).not.toHaveBeenCalled();
      expect(folioChargesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('inventory entitlement (1C-a3)', () => {
    it('PENDING -> CANCELLED releases the entitlement exactly once', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.PENDING }),
      );

      await service.cancel(propertyId, reservationId, 'guest request');

      expect(availabilityService.restore).toHaveBeenCalledTimes(1);
      expect(availabilityService.restore).toHaveBeenCalledWith(
        { propertyId, roomTypeId, nights: ['2026-07-15', '2026-07-16'], units: 1 },
        expect.anything(),
      );
    });

    it('CONFIRMED -> CANCELLED releases the entitlement exactly once', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.CONFIRMED }),
      );

      await service.cancel(propertyId, reservationId, null);

      expect(availabilityService.restore).toHaveBeenCalledTimes(1);
    });

    it('CONFIRMED -> NO_SHOW releases the entitlement exactly once', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.CONFIRMED }),
      );

      await service.markNoShow(propertyId, reservationId, null);

      expect(availabilityService.restore).toHaveBeenCalledTimes(1);
    });

    it('CHECKED_IN -> CHECKED_OUT releases the entitlement exactly once', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(availabilityService.restore).toHaveBeenCalledTimes(1);
      expect(availabilityService.restore).toHaveBeenCalledWith(
        { propertyId, roomTypeId, nights: ['2026-07-15', '2026-07-16'], units: 1 },
        expect.anything(),
      );
    });

    it('cannot double-release: cancelling an already-cancelled reservation throws and does not restore', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.CANCELLED }),
      );

      await expect(service.cancel(propertyId, reservationId, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(availabilityService.restore).not.toHaveBeenCalled();
    });

    it('never phantom-releases: cancelling a reservation that never reserved inventory does NOT restore', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.CONFIRMED, inventoryReserved: false }),
      );

      await service.cancel(propertyId, reservationId, 'legacy');

      expect(availabilityService.restore).not.toHaveBeenCalled();
    });

    it('date extension reserves ONLY the added nights (no release)', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await service.extendStay(propertyId, reservationId, { departureDate: '2026-07-18' });

      expect(availabilityService.applyDelta).toHaveBeenCalledTimes(1);
      expect(availabilityService.applyDelta).toHaveBeenCalledWith(
        {
          propertyId,
          toRelease: [],
          toReserve: [{ roomTypeId, date: '2026-07-17' }],
          units: 1,
        },
        expect.anything(),
      );
    });
  });

  describe('moveRoom', () => {
    beforeEach(() => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, roomNumber: '305' })
          : roomEntity({ id: roomId, operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );
    });

    it('moves checked-in reservation to ready target room', async () => {
      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId, reason: 'Guest requested quieter room' }),
      ).resolves.toMatchObject({
        reservation: { id: reservationId, roomId: targetRoomId },
        room: { id: targetRoomId, operationalStatus: RoomOperationalStatus.OCCUPIED },
      });

      // roomId change is a physical assignment only — zero inventory effect.
      expect(availabilityService.reserve).not.toHaveBeenCalled();
      expect(availabilityService.restore).not.toHaveBeenCalled();
      expect(availabilityService.applyDelta).not.toHaveBeenCalled();
    });

    it('marks old room for cleaning', async () => {
      await service.moveRoom(propertyId, reservationId, { roomId: targetRoomId });

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: roomId,
          operationalStatus: RoomOperationalStatus.NEEDS_CLEANING,
          operationalStatusReason: 'ROOM_MOVE',
        }),
      );
    });

    it.each([
      RoomOperationalStatus.MAINTENANCE,
      RoomOperationalStatus.OUT_OF_SERVICE,
      RoomOperationalStatus.OUT_OF_ORDER,
    ])('preserves old room %s state when relocating guest', async (status) => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, roomNumber: '305' })
          : roomEntity({
              id: roomId,
              operationalStatus: status,
              operationalStatusReason: 'Existing issue',
              operationalStatusNote: 'Do not clear this issue',
            }),
      );

      await service.moveRoom(propertyId, reservationId, {
        roomId: targetRoomId,
        reason: 'Relocation required',
      });

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: roomId,
          operationalStatus: status,
          operationalStatusReason: 'Existing issue',
          operationalStatusNote: 'Do not clear this issue',
        }),
      );
    });

    it('creates audit and activity events', async () => {
      await service.moveRoom(propertyId, reservationId, { roomId: targetRoomId });

      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RESERVATION_ROOM_MOVED' }),
      );
      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ROOM_MOVED' }),
      );
    });

    it('rejects reservation that is not checked in', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects missing room assignment', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.CHECKED_IN }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects same target room', async () => {
      await expect(
        service.moveRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects missing target room', async () => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId ? null : roomEntity({ id: roomId }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects target room from another property', async () => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, propertyId: otherPropertyId })
          : roomEntity({ id: roomId }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unavailable target room', async () => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, operationalStatus: RoomOperationalStatus.NEEDS_CLEANING })
          : roomEntity({ id: roomId }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects overlapping target room assignment', async () => {
      reservationsRepository.count?.mockResolvedValue(1);

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('approveLateCheckout', () => {
    it('approves late checkout on checked in reservation and emits events without mutating room status', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId,
          status: ReservationStatus.CHECKED_IN,
          departureDate: '2099-12-31',
        }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      const result = await service.approveLateCheckout(
        propertyId,
        reservationId,
        { approvedUntil: '14:00', notes: 'Flight in evening' },
        { actorId: 'user-1' },
      );

      expect(reservationsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReservationStatus.CHECKED_IN,
          lateCheckoutApprovedUntil: '14:00',
          lateCheckoutApprovedBy: 'user-1',
          lateCheckoutNotes: 'Flight in evening',
          lateCheckoutApprovedAt: expect.any(Date),
        }),
      );
      expect(roomsRepository.save).not.toHaveBeenCalled();
      expect(result.reservation).toMatchObject({
        id: reservationId,
        status: ReservationStatus.CHECKED_IN,
        lateCheckoutApprovedUntil: '14:00',
      });
      expect(result.room).toMatchObject({
        id: roomId,
        operationalStatus: RoomOperationalStatus.OCCUPIED,
      });
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RESERVATION_LATE_CHECKOUT_APPROVED' }),
      );
      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LATE_CHECKOUT_APPROVED',
          metadata: expect.objectContaining({ approvedUntil: '14:00', notes: 'Flight in evening' }),
        }),
      );
    });

    it('rejects late checkout when reservation is not checked in', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId,
          status: ReservationStatus.CONFIRMED,
          departureDate: '2099-12-31',
        }),
      );

      await expect(
        service.approveLateCheckout(propertyId, reservationId, { approvedUntil: '14:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects late checkout when reservation has no assigned room', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId: null,
          status: ReservationStatus.CHECKED_IN,
          departureDate: '2099-12-31',
        }),
      );

      await expect(
        service.approveLateCheckout(propertyId, reservationId, { approvedUntil: '14:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects late checkout when reservation departure date has already passed', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId,
          status: ReservationStatus.CHECKED_IN,
          departureDate: '2020-01-01',
        }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await expect(
        service.approveLateCheckout(propertyId, reservationId, { approvedUntil: '14:00' }),
      ).rejects.toThrow('Reservation departure date has passed. Extend stay to update the departure date.');
    });

    it('rejects late checkout when approved time is earlier than or equal to standard checkout time', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({
          roomId,
          status: ReservationStatus.CHECKED_IN,
          departureDate: '2099-12-31',
        }),
      );
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await expect(
        service.approveLateCheckout(propertyId, reservationId, { approvedUntil: '10:30' }),
      ).rejects.toThrow('Approved late checkout time must be later than standard checkout time (11:00 AM).');

      await expect(
        service.approveLateCheckout(propertyId, reservationId, { approvedUntil: '11:00' }),
      ).rejects.toThrow('Approved late checkout time must be later than standard checkout time (11:00 AM).');
    });
  });
});
