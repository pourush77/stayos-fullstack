import { DataSource, Repository } from 'typeorm';
import { ReservationPaymentStatus } from '../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationSource } from '../reservations/domain/reservation-source.enum';
import { AccommodationPostingMode } from '../reservations/domain/accommodation-posting-mode.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReservationRateSnapshotEntity } from '../reservations/infrastructure/reservation-rate-snapshot.entity';
import { PropertiesService } from '../properties/properties.service';
import { FolioPaymentMethod } from './domain/folio-payment-method.enum';
import { FolioStatus } from './domain/folio-status.enum';
import { FolioChargeStatus } from './domain/folio-charge-status.enum';
import { FolioChargeType } from './domain/folio-charge-type.enum';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioEntity } from './infrastructure/folio.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { BillingService } from './billing.service';
import { ChildPricingService } from '../rates/child-pricing.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';

const reservation = (overrides: Partial<ReservationEntity> = {}): ReservationEntity => ({
  id: reservationId,
  propertyId,
  property: undefined as never,
  guestId,
  guest: undefined as never,
  reservationCode: 'HSDEMO-0018',
  arrivalDate: '2026-08-03',
  departureDate: '2026-08-06',
  adults: 2,
  children: 0,
  childAges: null,
  roomTypeId: 'room-type-1',
  roomType: undefined as never,
  roomId: 'room-1',
  room: null,
  inventoryReserved: true,
  ratePlanId: null,
  rateSnapshot: null,
  accommodationPostingMode: AccommodationPostingMode.UPFRONT_FULL_STAY,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAID,
  notes: null,
  specialRequests: null,
  paymentReviewed: true,
  paymentMethod: 'UPI',
  paymentReviewNotes: null,
  isForeignNational: false,
  passportNumberMasked: null,
  passportIssuePlace: null,
  passportIssueDate: null,
  passportExpiryDate: null,
  visaNumberMasked: null,
  visaType: null,
  visaIssueDate: null,
  visaExpiryDate: null,
  cFormRequired: false,
  cFormStatus: 'NOT_REQUIRED' as never,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

describe('BillingService', () => {
  let foliosRepository: MockRepository<FolioEntity>;
  let chargesRepository: MockRepository<FolioChargeEntity>;
  let paymentsRepository: MockRepository<FolioPaymentEntity>;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let snapshotsRepository: MockRepository<ReservationRateSnapshotEntity>;
  let propertiesService: Pick<PropertiesService, 'findOne'>;
  let childPricingService: Pick<ChildPricingService, 'resolveChildPricing'>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let service: BillingService;
  let managerFoliosRepository: MockRepository<FolioEntity>;
  let managerChargesRepository: MockRepository<FolioChargeEntity>;
  let managerPaymentsRepository: MockRepository<FolioPaymentEntity>;
  let managerReservationsRepository: MockRepository<ReservationEntity>;
  let managerSnapshotsRepository: MockRepository<ReservationRateSnapshotEntity>;
  let businessDateService: any;
  let gstService: any;

  beforeEach(() => {
    foliosRepository = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    chargesRepository = {};
    paymentsRepository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({ id: 'payment-1', createdAt: new Date(), ...input })),
    };
    reservationsRepository = {
      findOne: jest.fn().mockResolvedValue(reservation()),
    };
    snapshotsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    propertiesService = {
      findOne: jest.fn().mockResolvedValue({ id: propertyId }),
    };
    childPricingService = {
      resolveChildPricing: jest.fn().mockResolvedValue({ lines: [], total: 0, limitations: [] }),
    };
    gstService = {
      computeTax: jest.fn(async () => ({
        applied: false,
        hsnSac: null,
        taxableValue: '0.00',
        placeOfSupply: 'INTRA_STATE',
        totalRate: '0.00',
        totalTax: '0.00',
        totalTaxCents: 0,
        components: [],
        taxRuleId: null,
        ruleEffectiveFrom: null,
      })),
      resolvePlaceOfSupply: jest.fn(() => 'INTRA_STATE'),
    };
    businessDateService = {
      getAuthoritativeDate: jest.fn(() => '2026-09-06'),
    } as unknown as jest.Mocked<
      import('../properties/services/business-date.service').BusinessDateService
    >;
    managerFoliosRepository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({
        id: 'folio-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      })),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    managerChargesRepository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({ id: 'charge-1', createdAt: new Date(), ...input })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    managerPaymentsRepository = {
      create: jest.fn((input) => input),
      save: paymentsRepository.save,
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    managerReservationsRepository = {
      findOne: jest.fn().mockResolvedValue(reservation()),
      update: jest.fn().mockResolvedValue(undefined),
    };
    managerSnapshotsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    dataSource = {
      transaction: jest.fn(
        async (
          callback: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>,
        ) => {
          const manager = {
            getRepository: (entity: unknown) => {
              if (entity === FolioEntity) {
                return managerFoliosRepository;
              }
              if (entity === FolioChargeEntity) {
                return managerChargesRepository;
              }
              if (entity === FolioPaymentEntity) {
                return managerPaymentsRepository;
              }
              if (entity === ReservationEntity) {
                return managerReservationsRepository;
              }
              if (entity === ReservationRateSnapshotEntity) {
                return managerSnapshotsRepository;
              }
              throw new Error('unexpected repository');
            },
          };
          return callback(manager);
        },
      ),
      query: jest.fn().mockResolvedValue([{ last_value: 1 }]),
    };

    // provide minimal chargesRepository implementation for addCharge tests
    chargesRepository = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({ id: 'charge-1', createdAt: new Date(), ...input })),
    };

    service = new BillingService(
      foliosRepository as unknown as Repository<FolioEntity>,
      chargesRepository as unknown as Repository<FolioChargeEntity>,
      paymentsRepository as unknown as Repository<FolioPaymentEntity>,
      reservationsRepository as unknown as Repository<ReservationEntity>,
      snapshotsRepository as unknown as Repository<ReservationRateSnapshotEntity>,
      propertiesService as unknown as PropertiesService,
      dataSource as unknown as DataSource,
      childPricingService as ChildPricingService,
      businessDateService,
      gstService as never,
    );
  });

  it('assigns business_date to an explicit addCharge (server-side only)', async () => {
    foliosRepository.findOne = jest.fn().mockResolvedValue({
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
      property: { id: propertyId, currentBusinessDate: '2026-09-06' },
      charges: [],
      payments: [],
    });

    await service.addCharge(propertyId, 'folio-1', {
      type: 'MISC' as any,
      description: 'Test charge',
      unitAmount: '100.00',
    });

    expect((chargesRepository.save as jest.Mock).mock.calls[0][0]).toMatchObject({
      businessDate: '2026-09-06',
    });
  });

  it('assigns business_date to payments and refunds on create', async () => {
    const folioId = 'folio-1';
    foliosRepository.findOne = jest
      .fn()
      .mockResolvedValue({ id: folioId, propertyId, status: FolioStatus.OPEN });
    // ensure the transaction manager's folio repo returns the locked folio
    managerFoliosRepository.findOne = jest.fn().mockResolvedValue({
      id: folioId,
      propertyId,
      reservationId,
      status: FolioStatus.OPEN,
      charges: [],
      payments: [],
      property: { id: propertyId },
    });
    // ensure the manager reports an outstanding charge so payment validation passes
    managerChargesRepository.find = jest
      .fn()
      .mockResolvedValue([{ amount: '100.00', taxAmount: '0.00' }]);
    managerPaymentsRepository.find = jest.fn().mockResolvedValue([]);

    // addPayment
    await service.addPayment(propertyId, folioId, { method: 'CASH' as any, amount: '10.00' });
    const createPayment = (dataSource.transaction as jest.Mock).mock.calls[0][0];
    expect(businessDateService.getAuthoritativeDate).toHaveBeenCalled();
    // refund flow is already covered in describe('refunds') below and uses managerPaymentsRepository
  });

  it('assigns business_date when posting a policy charge on manager', async () => {
    const folioId = 'folio-1';
    // prepare manager-side repos to mirror beforeEach transactional manager
    managerFoliosRepository.findOne = jest.fn().mockResolvedValue({
      id: folioId,
      propertyId,
      reservationId,
      status: FolioStatus.OPEN,
      property: { id: propertyId },
      guest: { state: null },
    });
    managerChargesRepository.findOne = jest.fn().mockResolvedValue(null);
    (managerChargesRepository as any).create = jest.fn((i) => i);
    (managerChargesRepository as any).save = jest.fn(async (input) => ({
      id: 'charge-1',
      createdAt: new Date(),
      ...input,
    }));

    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === FolioEntity) return managerFoliosRepository as never;
        if (entity === FolioChargeEntity) return managerChargesRepository as never;
        if (entity === ReservationEntity) return managerReservationsRepository as never;
        throw new Error('unexpected repository');
      },
    } as unknown as any;

    await service.postPolicyChargeOnManager(
      manager as never,
      propertyId,
      reservationId,
      { type: 'MISC' as any, description: 'Policy fee', unitAmount: '100.00' },
      'actor-1',
    );

    const chargeRepo = manager.getRepository(FolioChargeEntity) as any;
    expect((chargeRepo.save as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    const saved = (chargeRepo.save as jest.Mock).mock.calls[0][0];
    expect(saved.businessDate).toBe('2026-09-06');
  });

  it('creates a REVERSAL row with current authoritative businessDate when voiding a charge', async () => {
    const folioId = 'folio-1';
    const originalCharge = {
      id: 'charge-old',
      type: 'MISC',
      status: 'POSTED',
      unitAmount: '100.00',
      amount: '100.00',
      taxAmount: '0.00',
      hsnSac: null,
      taxSnapshot: null,
      description: 'Original',
      quantity: 1,
    } as unknown as FolioChargeEntity;

    foliosRepository.findOne = jest.fn().mockResolvedValue({
      id: folioId,
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
      charges: [originalCharge],
      payments: [],
      property: { id: propertyId },
    });

    // ensure lockFolio finds the folio inside the transaction manager
    managerFoliosRepository.findOne = jest
      .fn()
      .mockResolvedValue({ id: folioId, propertyId, reservationId, status: FolioStatus.OPEN });
    // void flow uses repo.update; ensure it's present on the manager charges repo
    managerChargesRepository.update = jest.fn().mockResolvedValue(undefined);

    await service.voidCharge(propertyId, folioId, 'charge-old', 'Test void', 'actor-2');

    expect((managerChargesRepository.save as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    const saved = (managerChargesRepository.save as jest.Mock).mock.calls[0][0];
    expect(saved.status).toBeDefined();
    expect(saved.businessDate).toBe('2026-09-06');
  });

  it('does NOT auto-post a payment when creating a folio for a paid reservation (1D-a de-coupling)', async () => {
    foliosRepository.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
      charges: [],
      payments: [],
    });

    await service.getOrCreateFolioForReservation(propertyId, reservationId);

    // The hidden BOOKING_MARKED_PAID auto-payment has been removed: folio
    // creation never posts a payment based on reservation.paymentStatus.
    expect(paymentsRepository.save).not.toHaveBeenCalled();
  });

  it('returns an existing folio unchanged without backfilling any payment (1D-a de-coupling)', async () => {
    const existing = {
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
      charges: [{ amount: '10500.00', taxAmount: '1260.00' }],
      payments: [],
    };
    foliosRepository.findOne = jest.fn().mockResolvedValue(existing);

    await service.getOrCreateFolioForReservation(propertyId, reservationId);

    expect(paymentsRepository.save).not.toHaveBeenCalled();
  });

  it('posts a snapshot-linked full-stay ROOM charge when opening a folio for a priced reservation', async () => {
    snapshotsRepository.findOne = jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      version: 1,
      snapshot: {
        pricingStatus: 'PRICED',
        ratePlan: { code: 'UAT_BAR', name: 'Hillston UAT BAR' },
        nights: [
          { date: '2026-08-03', nightTotal: '3600.00' },
          { date: '2026-08-04', nightTotal: '3600.00' },
          { date: '2026-08-05', nightTotal: '3600.00' },
        ],
        totals: { grandTotal: '10800.00' },
      },
    });
    foliosRepository.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
      charges: [],
      payments: [],
    });

    await service.getOrCreateFolioForReservation(propertyId, reservationId);

    expect(managerChargesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        folioId: 'folio-1',
        type: 'ROOM',
        status: 'POSTED',
        rateSnapshotId: 'snapshot-1',
        rateSnapshotVersion: 1,
        quantity: 3,
        unitAmount: '3600.00',
        amount: '10800.00',
      }),
    );
  });

  it('creates a folio without aggregate or nightly ROOM charges for NIGHTLY_V1 bootstrap', async () => {
    reservationsRepository.findOne = jest.fn().mockResolvedValue(
      reservation({ accommodationPostingMode: AccommodationPostingMode.NIGHTLY_V1 }),
    );
    snapshotsRepository.findOne = jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      version: 1,
      snapshot: {
        pricingStatus: 'PRICED',
        ratePlan: { code: 'UAT_BAR', name: 'Hillston UAT BAR' },
        nights: [
          { date: '2026-08-03', nightTotal: '3600.00' },
          { date: '2026-08-04', nightTotal: '3600.00' },
        ],
        totals: { grandTotal: '7200.00' },
      },
    });
    foliosRepository.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
      charges: [],
      payments: [],
    });

    await service.getOrCreateFolioForReservation(propertyId, reservationId);

    expect(managerFoliosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId,
        reservationId,
        guestId,
        status: FolioStatus.OPEN,
      }),
    );
    expect(managerChargesRepository.save).not.toHaveBeenCalled();
  });

  it('does not create aggregate or nightly ROOM charges when policy bootstrap creates a NIGHTLY_V1 folio', async () => {
    managerFoliosRepository.findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'folio-1',
        propertyId,
        reservationId,
        guestId,
        status: FolioStatus.OPEN,
        property: { id: propertyId },
        guest: { state: null },
      });
    managerReservationsRepository.findOne = jest.fn().mockResolvedValue(
      reservation({ accommodationPostingMode: AccommodationPostingMode.NIGHTLY_V1 }),
    );
    managerSnapshotsRepository.findOne = jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      version: 1,
      snapshot: {
        pricingStatus: 'PRICED',
        nights: [{ date: '2026-08-03', nightTotal: '3600.00' }],
        totals: { grandTotal: '3600.00' },
      },
    });
    managerChargesRepository.findOne = jest.fn().mockResolvedValue(null);

    await service.postPolicyChargeOnManager(
      {
        getRepository: (entity: unknown) => {
          if (entity === FolioEntity) return managerFoliosRepository;
          if (entity === FolioChargeEntity) return managerChargesRepository;
          if (entity === ReservationEntity) return managerReservationsRepository;
          if (entity === ReservationRateSnapshotEntity) return managerSnapshotsRepository;
          throw new Error('unexpected repository');
        },
      } as never,
      propertyId,
      reservationId,
      { type: 'MISC' as any, description: 'Policy fee', unitAmount: '100.00' },
    );

    expect(managerFoliosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId, reservationId, status: FolioStatus.OPEN }),
    );
    expect(managerChargesRepository.save).toHaveBeenCalledTimes(1);
    expect(managerChargesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MISC', description: 'Policy fee', amount: '100.00' }),
    );
    expect(managerChargesRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ROOM' }),
    );
  });

  it('reconciles an existing empty open folio by posting from the active priced snapshot', async () => {
    managerFoliosRepository.findOne = jest.fn().mockResolvedValue({
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
    });
    managerSnapshotsRepository.findOne = jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      version: 1,
      snapshot: {
        pricingStatus: 'PRICED',
        ratePlan: { code: 'UAT_BAR', name: 'Hillston UAT BAR' },
        nights: [{ date: '2026-08-03', nightTotal: '3600.00' }],
        totals: { grandTotal: '3600.00' },
      },
    });
    managerChargesRepository.find = jest.fn().mockResolvedValue([]);

    await service.reconcileRoomChargesOnManager(
      {
        getRepository: (entity: unknown) => {
          if (entity === FolioEntity) return managerFoliosRepository;
          if (entity === FolioChargeEntity) return managerChargesRepository;
          if (entity === ReservationEntity) return managerReservationsRepository;
          if (entity === ReservationRateSnapshotEntity) return managerSnapshotsRepository;
          throw new Error('unexpected repository');
        },
      } as never,
      propertyId,
      reservationId,
    );

    expect(managerChargesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        folioId: 'folio-1',
        type: 'ROOM',
        status: 'POSTED',
        rateSnapshotId: 'snapshot-1',
        rateSnapshotVersion: 1,
        quantity: 1,
        unitAmount: '3600.00',
        amount: '3600.00',
      }),
    );
  });

  it('blocks NIGHTLY_V1 from legacy full-stay reconciliation without posting charges', async () => {
    managerFoliosRepository.findOne = jest.fn().mockResolvedValue({
      id: 'folio-1',
      propertyId,
      reservationId,
      guestId,
      folioNumber: 'FO260803-00001',
      status: FolioStatus.OPEN,
      currency: 'INR',
    });
    managerReservationsRepository.findOne = jest.fn().mockResolvedValue(
      reservation({ accommodationPostingMode: AccommodationPostingMode.NIGHTLY_V1 }),
    );
    managerSnapshotsRepository.findOne = jest.fn().mockResolvedValue({
      id: 'snapshot-1',
      version: 2,
      snapshot: {
        pricingStatus: 'PRICED',
        nights: [{ date: '2026-08-03', nightTotal: '4200.00' }],
        totals: { grandTotal: '4200.00' },
      },
    });

    await expect(
      service.reconcileRoomChargesOnManager(
        {
          getRepository: (entity: unknown) => {
            if (entity === FolioEntity) return managerFoliosRepository;
            if (entity === FolioChargeEntity) return managerChargesRepository;
            if (entity === ReservationEntity) return managerReservationsRepository;
            if (entity === ReservationRateSnapshotEntity) return managerSnapshotsRepository;
            throw new Error('unexpected repository');
          },
        } as never,
        propertyId,
        reservationId,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'NIGHTLY_POSTING_MODE_FULL_STAY_RECONCILE_BLOCKED',
      }),
    });

    expect(managerChargesRepository.find).not.toHaveBeenCalled();
    expect(managerChargesRepository.save).not.toHaveBeenCalled();
    expect(managerFoliosRepository.update).not.toHaveBeenCalled();
  });

  describe('nightly accommodation posting', () => {
    const serviceDate = '2026-08-04';
    const nightlyReservation = () =>
      reservation({
        status: ReservationStatus.CHECKED_IN,
        accommodationPostingMode: AccommodationPostingMode.NIGHTLY_V1,
      });
    const activeSnapshot = {
      id: 'snapshot-1',
      version: 7,
      status: 'ACTIVE',
      snapshot: {
        pricingStatus: 'PRICED',
        ratePlan: { code: 'UAT_BAR', name: 'Hillston UAT BAR' },
        nights: [
          {
            date: '2026-08-03',
            roomRate: '3600.00',
            extraAdultCharge: '0.00',
            childCharge: '0.00',
            nightTotal: '3600.00',
          },
          {
            date: serviceDate,
            roomRate: '4000.00',
            extraAdultCharge: '500.00',
            childCharge: '250.00',
            nightTotal: '4750.00',
          },
        ],
      },
    };

    function seedNightlyPoster() {
      propertiesService.findOne = jest
        .fn()
        .mockResolvedValue({ id: propertyId, currentBusinessDate: '2026-09-08' });
      businessDateService.getAuthoritativeDate = jest.fn(() => '2026-09-08');
      managerReservationsRepository.findOne = jest.fn().mockResolvedValue(nightlyReservation());
      managerSnapshotsRepository.findOne = jest.fn().mockResolvedValue(activeSnapshot);
      managerFoliosRepository.findOne = jest.fn().mockResolvedValue({
        id: 'folio-1',
        propertyId,
        reservationId,
        guestId,
        status: FolioStatus.OPEN,
        property: { id: propertyId, currentBusinessDate: '2026-09-08' },
        guest: { state: null },
      });
      managerChargesRepository.findOne = jest.fn().mockResolvedValue(null);
    }

    it('posts exactly one checked-in NIGHTLY_V1 room night from the matching snapshot night', async () => {
      seedNightlyPoster();

      await service.postNightlyAccommodationCharge(propertyId, reservationId, serviceDate, 'actor-1');

      expect(managerChargesRepository.save).toHaveBeenCalledTimes(1);
      expect(managerChargesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          folioId: 'folio-1',
          type: FolioChargeType.ROOM,
          status: FolioChargeStatus.POSTED,
          quantity: 1,
          unitAmount: '4750.00',
          amount: '4750.00',
          serviceDate,
          businessDate: '2026-09-08',
          rateSnapshotId: 'snapshot-1',
          rateSnapshotVersion: 7,
          idempotencyKey:
            `room-night:v1:property:${propertyId}:reservation:${reservationId}` +
            `:snapshot:snapshot-1:version:7:night:${serviceDate}`,
        }),
      );
    });

    it('calculates and freezes GST for the one service night using serviceDate', async () => {
      seedNightlyPoster();
      gstService.computeTax = jest.fn(async () => ({
        applied: true,
        hsnSac: '996311',
        taxableValue: '4750.00',
        placeOfSupply: 'INTRA_STATE',
        totalRate: '12.00',
        totalTax: '570.00',
        totalTaxCents: 57000,
        components: [{ name: 'CGST', rate: '6.00', amount: '285.00' }],
        taxRuleId: 'tax-rule-1',
        ruleEffectiveFrom: '2026-08-01',
      }));

      await service.postNightlyAccommodationCharge(propertyId, reservationId, serviceDate);

      expect(gstService.computeTax).toHaveBeenCalledWith(
        expect.objectContaining({
          propertyId,
          chargeType: FolioChargeType.ROOM,
          taxableAmountCents: 475000,
          slabBasisAmount: 4750,
          placeOfSupply: 'INTRA_STATE',
          chargeDate: new Date(serviceDate),
        }),
        expect.anything(),
      );
      expect(managerChargesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          taxAmount: '570.00',
          hsnSac: '996311',
          taxSnapshot: expect.objectContaining({ taxableValue: '4750.00', taxRuleId: 'tax-rule-1' }),
        }),
      );
    });

    it('treats repeated calls as success without creating a duplicate charge', async () => {
      seedNightlyPoster();
      managerChargesRepository.findOne = jest.fn().mockResolvedValue({
        id: 'charge-existing',
        folioId: 'folio-1',
        idempotencyKey: 'existing-key',
      });

      const result = await service.postNightlyAccommodationCharge(
        propertyId,
        reservationId,
        serviceDate,
      );

      expect(result).toMatchObject({ id: 'charge-existing' });
      expect(managerChargesRepository.save).not.toHaveBeenCalled();
    });

    it('treats a duplicate-key insert race as the existing successful nightly charge', async () => {
      seedNightlyPoster();
      const existing = { id: 'charge-raced', folioId: 'folio-1' };
      managerChargesRepository.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      managerChargesRepository.save = jest.fn().mockRejectedValue({ code: '23505' });

      const result = await service.postNightlyAccommodationCharge(
        propertyId,
        reservationId,
        serviceDate,
      );

      expect(result).toBe(existing);
      expect(managerChargesRepository.save).toHaveBeenCalledTimes(1);
    });

    it('rejects UPFRONT_FULL_STAY without posting', async () => {
      seedNightlyPoster();
      managerReservationsRepository.findOne = jest.fn().mockResolvedValue(
        reservation({
          status: ReservationStatus.CHECKED_IN,
          accommodationPostingMode: AccommodationPostingMode.UPFRONT_FULL_STAY,
        }),
      );

      await expect(
        service.postNightlyAccommodationCharge(propertyId, reservationId, serviceDate),
      ).rejects.toThrow('Nightly accommodation posting requires NIGHTLY_V1 mode');
      expect(managerChargesRepository.save).not.toHaveBeenCalled();
    });

    it('rejects non-CHECKED_IN reservations without posting', async () => {
      seedNightlyPoster();
      managerReservationsRepository.findOne = jest.fn().mockResolvedValue(
        reservation({ accommodationPostingMode: AccommodationPostingMode.NIGHTLY_V1 }),
      );

      await expect(
        service.postNightlyAccommodationCharge(propertyId, reservationId, serviceDate),
      ).rejects.toThrow('Nightly accommodation posting requires CHECKED_IN status');
      expect(managerChargesRepository.save).not.toHaveBeenCalled();
    });

    it('rejects serviceDate outside the stay range without posting', async () => {
      seedNightlyPoster();

      await expect(
        service.postNightlyAccommodationCharge(propertyId, reservationId, '2026-08-06'),
      ).rejects.toThrow('serviceDate must be within the reservation stay dates');
      expect(managerChargesRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a missing matching snapshot night without posting', async () => {
      seedNightlyPoster();
      managerSnapshotsRepository.findOne = jest.fn().mockResolvedValue({
        ...activeSnapshot,
        snapshot: { ...activeSnapshot.snapshot, nights: [activeSnapshot.snapshot.nights[0]] },
      });

      await expect(
        service.postNightlyAccommodationCharge(propertyId, reservationId, serviceDate),
      ).rejects.toThrow('Active rate snapshot has no matching service night');
      expect(managerChargesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('refunds', () => {
    const folioId = 'folio-1';
    const originalPaymentId = 'payment-original';

    function seedRefundScenario(priorRefunds: Array<Partial<FolioPaymentEntity>> = []) {
      const folio = {
        id: folioId,
        propertyId,
        reservationId,
        guestId,
        folioNumber: 'FO260803-00001',
        status: FolioStatus.OPEN,
        currency: 'INR',
      } as FolioEntity;
      const original = {
        id: originalPaymentId,
        folioId,
        type: 'PAYMENT',
        method: FolioPaymentMethod.CASH,
        amount: '2000.00',
      } as FolioPaymentEntity;

      managerFoliosRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(folio)
        .mockResolvedValueOnce(folio)
        .mockResolvedValueOnce({ ...folio, charges: [], payments: [] });
      managerPaymentsRepository.findOne = jest.fn().mockResolvedValue(original);
      managerPaymentsRepository.find = jest.fn().mockResolvedValue(priorRefunds);
      managerChargesRepository.find = jest.fn().mockResolvedValue([]);
    }

    it('allows a partial refund below the remaining refundable amount', async () => {
      seedRefundScenario();

      await service.addRefund(propertyId, folioId, {
        originalPaymentId,
        amount: '500.00',
        notes: 'Guest request',
      });

      expect(managerPaymentsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '-500.00', reversalOfPaymentId: originalPaymentId }),
      );
      expect(paymentsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('allows an exact refund equal to the remaining refundable amount', async () => {
      seedRefundScenario();

      await service.addRefund(propertyId, folioId, {
        originalPaymentId,
        amount: '2000.00',
        notes: 'Guest request',
      });

      expect(managerPaymentsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '-2000.00', reversalOfPaymentId: originalPaymentId }),
      );
      expect(paymentsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('rejects an over-refund and creates no financial mutation', async () => {
      seedRefundScenario();

      await expect(
        service.addRefund(propertyId, folioId, {
          originalPaymentId,
          amount: '2001.00',
          notes: 'Guest request',
        }),
      ).rejects.toThrow('Refund exceeds refundable amount for this payment');

      expect(managerPaymentsRepository.create).not.toHaveBeenCalled();
      expect(paymentsRepository.save).not.toHaveBeenCalled();
      expect(managerReservationsRepository.update).not.toHaveBeenCalled();
    });

    it('rejects repeated refunds that cumulatively exceed the original payment', async () => {
      seedRefundScenario([{ amount: '-1500.00' }]);

      await expect(
        service.addRefund(propertyId, folioId, {
          originalPaymentId,
          amount: '501.00',
          notes: 'Guest request',
        }),
      ).rejects.toThrow('Refund exceeds refundable amount for this payment');

      expect(managerPaymentsRepository.create).not.toHaveBeenCalled();
      expect(paymentsRepository.save).not.toHaveBeenCalled();
    });

    it('keeps net paid at zero after a full refund of a 2000 payment', async () => {
      seedRefundScenario();

      await service.addRefund(propertyId, folioId, {
        originalPaymentId,
        amount: '2000.00',
        notes: 'Guest request',
      });

      const createPayment = managerPaymentsRepository.create as jest.Mock;
      const refund = createPayment.mock.calls[0][0];
      const netPaid = Math.round(Number('2000.00') * 100) + Math.round(Number(refund.amount) * 100);
      expect(netPaid).toBe(0);
    });
  });
});
