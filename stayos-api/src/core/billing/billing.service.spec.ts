import { DataSource, Repository } from 'typeorm';
import { ReservationPaymentStatus } from '../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationSource } from '../reservations/domain/reservation-source.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { PropertiesService } from '../properties/properties.service';
import { FolioPaymentMethod } from './domain/folio-payment-method.enum';
import { FolioStatus } from './domain/folio-status.enum';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioEntity } from './infrastructure/folio.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { BillingService } from './billing.service';

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
  roomTypeId: 'room-type-1',
  roomType: undefined as never,
  roomId: 'room-1',
  room: null,
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
  let propertiesService: Pick<PropertiesService, 'findOne'>;
  let dataSource: { transaction: jest.Mock };
  let service: BillingService;

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
    propertiesService = {
      findOne: jest.fn().mockResolvedValue({ id: propertyId }),
    };
    dataSource = {
      transaction: jest.fn(async (callback: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === FolioEntity) {
              return {
                create: jest.fn((input) => input),
                save: jest.fn(async (input) => ({ id: 'folio-1', createdAt: new Date(), updatedAt: new Date(), ...input })),
              };
            }
            if (entity === FolioChargeEntity) {
              return {
                create: jest.fn((input) => input),
                save: jest.fn(async (input) => ({ id: 'charge-1', createdAt: new Date(), ...input })),
              };
            }
            if (entity === FolioPaymentEntity) {
              return {
                create: jest.fn((input) => input),
                save: paymentsRepository.save,
              };
            }
            throw new Error('unexpected repository');
          },
        };
        return callback(manager);
      }),
    };

    service = new BillingService(
      foliosRepository as unknown as Repository<FolioEntity>,
      chargesRepository as unknown as Repository<FolioChargeEntity>,
      paymentsRepository as unknown as Repository<FolioPaymentEntity>,
      reservationsRepository as unknown as Repository<ReservationEntity>,
      propertiesService as unknown as PropertiesService,
      dataSource as unknown as DataSource,
    );
  });

  it('posts a matching folio payment when creating a folio for a paid reservation', async () => {
    foliosRepository.findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
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

    expect(paymentsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      amount: '11760.00',
      method: FolioPaymentMethod.OTHER,
      reference: 'BOOKING_MARKED_PAID',
    }));
  });

  it('backfills a missing folio payment for an existing paid reservation folio', async () => {
    foliosRepository.findOne = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'folio-1',
        propertyId,
        reservationId,
        guestId,
        folioNumber: 'FO260803-00001',
        status: FolioStatus.OPEN,
        currency: 'INR',
        charges: [{ amount: '10500.00', taxAmount: '1260.00' }],
        payments: [],
      })
      .mockResolvedValueOnce({
        id: 'folio-1',
        propertyId,
        reservationId,
        guestId,
        folioNumber: 'FO260803-00001',
        status: FolioStatus.OPEN,
        currency: 'INR',
        charges: [{ amount: '10500.00', taxAmount: '1260.00' }],
        payments: [{ amount: '11760.00', method: FolioPaymentMethod.OTHER }],
      });

    await service.getOrCreateFolioForReservation(propertyId, reservationId);

    expect(paymentsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      amount: '11760.00',
      reference: 'BOOKING_MARKED_PAID',
    }));
    expect(foliosRepository.update).toHaveBeenCalledWith({ id: 'folio-1' }, expect.objectContaining({ updatedAt: expect.any(Date) }));
  });
});
