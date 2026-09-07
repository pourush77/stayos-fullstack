import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FolioChargeType } from '../billing/domain/folio-charge-type.enum';
import { FolioPaymentMethod } from '../billing/domain/folio-payment-method.enum';
import { FolioChargeEntity } from '../billing/infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from '../billing/infrastructure/folio-payment.entity';
import { GuestRequestStatus } from '../guest-requests/domain/guest-request-status.enum';
import { GuestRequestEntity } from '../guest-requests/infrastructure/guest-request.entity';
import { ReservationSource } from '../reservations/domain/reservation-source.enum';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { OccupancyReportService } from './occupancy-report.service';
import { OperationsReportService } from './operations-report.service';
import { parseReportRange } from './reports-range';
import { RevenueReportService } from './revenue-report.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const asRepository = <T extends object>(repository: MockRepository<T>): Repository<T> =>
  repository as unknown as Repository<T>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';

describe('reports range validation', () => {
  it('rejects inverted ranges', () => {
    expect(() => parseReportRange('2026-07-31', '2026-07-01')).toThrow(BadRequestException);
  });

  it('rejects ranges over 365 days', () => {
    expect(() => parseReportRange('2025-01-01', '2026-02-01')).toThrow(BadRequestException);
  });

  it('accepts same-day ranges', () => {
    expect(parseReportRange('2026-07-30', '2026-07-30')).toMatchObject({ days: 1 });
  });
});

describe('OccupancyReportService', () => {
  let roomsRepository: MockRepository<RoomEntity>;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let service: OccupancyReportService;

  beforeEach(() => {
    roomsRepository = { count: jest.fn().mockResolvedValue(10) };
    reservationsRepository = { find: jest.fn().mockResolvedValue([]) };
    service = new OccupancyReportService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
    );
  });

  it('scopes room and reservation queries to property', async () => {
    await service.getOccupancy(propertyId, parseReportRange('2026-07-01', '2026-07-10'));
    expect(roomsRepository.count).toHaveBeenCalledWith({ where: { propertyId } });
    expect(reservationsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propertyId }),
      }),
    );
  });

  it('returns zero occupancy when there are no rooms', async () => {
    roomsRepository.count?.mockResolvedValue(0);
    await expect(
      service.getOccupancy(propertyId, parseReportRange('2026-07-01', '2026-07-10')),
    ).resolves.toMatchObject({
      occupancyPercent: 0,
      roomNightsAvailable: 0,
    });
  });

  it('computes occupied room nights from overlapping reservations', async () => {
    reservationsRepository.find?.mockResolvedValue([
      {
        arrivalDate: '2026-07-01',
        departureDate: '2026-07-04',
        source: ReservationSource.DIRECT,
        status: ReservationStatus.CHECKED_IN,
      },
    ]);
    await expect(
      service.getOccupancy(propertyId, parseReportRange('2026-07-01', '2026-07-10')),
    ).resolves.toMatchObject({
      roomNightsOccupied: 3,
      occupancyPercent: 3,
    });
  });
});

describe('RevenueReportService', () => {
  const occupancy = {
    totalRooms: 1,
    roomNightsAvailable: 1,
    roomNightsOccupied: 1,
    occupancyPercent: 100,
    bySource: [],
  };

  it('returns zero ADR and RevPAR when no room nights are occupied', async () => {
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
    );
    await expect(
      service.getRevenue(propertyId, parseReportRange('2026-07-01', '2026-07-10'), {
        totalRooms: 0,
        roomNightsAvailable: 0,
        roomNightsOccupied: 0,
        occupancyPercent: 0,
        bySource: [],
      }),
    ).resolves.toMatchObject({ adr: 0, revPar: 0, totalRevenue: 0 });
  });

  it('aggregates revenue by charge type and payment method', async () => {
    const chargesRepository = {
      find: jest.fn().mockResolvedValue([
        { type: FolioChargeType.ROOM, amount: '1000', taxAmount: '120' },
        { type: FolioChargeType.LAUNDRY, amount: '200', taxAmount: '0' },
      ]),
    };
    const paymentsRepository = {
      find: jest.fn().mockResolvedValue([
        { method: FolioPaymentMethod.CARD, amount: '500' },
        { method: FolioPaymentMethod.UPI, amount: '820' },
      ]),
    };
    const service = new RevenueReportService(
      asRepository(chargesRepository),
      asRepository(paymentsRepository),
    );
    await expect(
      service.getRevenue(propertyId, parseReportRange('2026-07-01', '2026-07-10'), {
        totalRooms: 10,
        roomNightsAvailable: 100,
        roomNightsOccupied: 10,
        occupancyPercent: 10,
        bySource: [],
      }),
    ).resolves.toMatchObject({ totalRevenue: 1320, totalPayments: 1320, adr: 132, revPar: 13.2 });
  });

  it('attributes a new charge by business_date when present', async () => {
    const chargesRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            type: FolioChargeType.ROOM,
            amount: '1000',
            taxAmount: '100',
            businessDate: new Date('2026-07-05'),
            chargedAt: new Date('2026-07-01T00:00:00Z'),
          },
        ]),
    };
    const paymentsRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new RevenueReportService(
      asRepository(chargesRepository),
      asRepository(paymentsRepository),
    );
    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-05', '2026-07-05'),
      {
        totalRooms: 1,
        roomNightsAvailable: 1,
        roomNightsOccupied: 1,
        occupancyPercent: 100,
        bySource: [],
      },
    );
    expect(result.totalRevenue).toBe(1100);
    expect(result.byChargeType).toEqual(
      expect.arrayContaining([{ label: FolioChargeType.ROOM, value: 1100 }]),
    );
  });

  it('attributes a new payment by business_date when present', async () => {
    const chargesRepository = { find: jest.fn().mockResolvedValue([]) };
    const paymentsRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            method: 'CARD',
            amount: '750',
            businessDate: new Date('2026-07-04'),
            receivedAt: new Date('2026-07-01T00:00:00Z'),
          },
        ]),
    };
    const service = new RevenueReportService(
      asRepository(chargesRepository),
      asRepository(paymentsRepository),
    );
    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-04', '2026-07-04'),
      {
        totalRooms: 1,
        roomNightsAvailable: 1,
        roomNightsOccupied: 1,
        occupancyPercent: 100,
        bySource: [],
      },
    );
    expect(result.totalPayments).toBe(750);
    expect(result.byPaymentMethod).toEqual(expect.arrayContaining([{ label: 'CARD', value: 750 }]));
  });

  it('includes rows where business_date differs from chargedAt and uses business_date for attribution', async () => {
    const chargesRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            type: FolioChargeType.ROOM,
            amount: '500',
            taxAmount: '50',
            businessDate: new Date('2026-07-09'),
            chargedAt: new Date('2026-07-01T00:00:00Z'),
          },
        ]),
    };
    const paymentsRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new RevenueReportService(
      asRepository(chargesRepository),
      asRepository(paymentsRepository),
    );
    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-09', '2026-07-09'),
      {
        totalRooms: 1,
        roomNightsAvailable: 1,
        roomNightsOccupied: 1,
        occupancyPercent: 100,
        bySource: [],
      },
    );
    expect(result.totalRevenue).toBe(550);
  });

  it('falls back to chargedAt/receivedAt when business_date is NULL (legacy rows)', async () => {
    const chargesRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            type: FolioChargeType.LAUNDRY,
            amount: '200',
            taxAmount: '0',
            businessDate: null,
            chargedAt: new Date('2026-07-03T12:00:00Z'),
          },
        ]),
    };
    const paymentsRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            method: 'CASH',
            amount: '200',
            businessDate: null,
            receivedAt: new Date('2026-07-03T13:00:00Z'),
          },
        ]),
    };
    const service = new RevenueReportService(
      asRepository(chargesRepository),
      asRepository(paymentsRepository),
    );
    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-03', '2026-07-03'),
      {
        totalRooms: 1,
        roomNightsAvailable: 1,
        roomNightsOccupied: 1,
        occupancyPercent: 100,
        bySource: [],
      },
    );
    expect(result.totalRevenue).toBe(200);
    expect(result.totalPayments).toBe(200);
    expect(result.byChargeType).toEqual(
      expect.arrayContaining([{ label: FolioChargeType.LAUNDRY, value: 200 }]),
    );
  });

  it('keeps individual payments included through folio property ownership', async () => {
    const paymentsRepository = {
      find: jest
        .fn()
        .mockResolvedValue([{ method: FolioPaymentMethod.CARD, amount: '300.00' }]),
    };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-04', '2026-07-04'),
      occupancy,
    );

    expect(result.totalPayments).toBe(300);
    expect(paymentsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ folio: { propertyId }, businessDate: expect.any(Object) }),
        ]),
      }),
    );
  });

  it('includes group master folio payments through group folio property ownership', async () => {
    const paymentsRepository = {
      find: jest.fn().mockResolvedValue([{ method: FolioPaymentMethod.UPI, amount: '450.00' }]),
    };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-04', '2026-07-04'),
      occupancy,
    );

    expect(result.totalPayments).toBe(450);
    expect(result.byPaymentMethod).toEqual(
      expect.arrayContaining([{ label: FolioPaymentMethod.UPI, value: 450 }]),
    );
    expect(paymentsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: ['folio', 'groupMasterFolio'],
        where: expect.arrayContaining([
          expect.objectContaining({
            groupMasterFolio: { propertyId },
            businessDate: expect.any(Object),
          }),
        ]),
      }),
    );
  });

  it('queries group payments by business_date when present', async () => {
    const paymentsRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    await service.getRevenue(propertyId, parseReportRange('2026-07-05', '2026-07-05'), occupancy);

    expect(paymentsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          {
            groupMasterFolio: { propertyId },
            businessDate: expect.any(Object),
          },
        ]),
      }),
    );
  });

  it('queries group payments with NULL business_date by receivedAt legacy fallback', async () => {
    const paymentsRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    await service.getRevenue(propertyId, parseReportRange('2026-07-05', '2026-07-05'), occupancy);

    expect(paymentsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          {
            groupMasterFolio: { propertyId },
            businessDate: expect.any(Object),
            receivedAt: expect.any(Object),
          },
        ]),
      }),
    );
  });

  it('lets group payment business_date override a differing receivedAt calendar date', async () => {
    const paymentsRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            method: FolioPaymentMethod.CASH,
            amount: '600.00',
            businessDate: new Date('2026-07-06'),
            receivedAt: new Date('2026-07-01T23:30:00Z'),
          },
        ]),
    };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-06', '2026-07-06'),
      occupancy,
    );

    const groupBusinessDateBranch = paymentsRepository.find.mock.calls[0][0].where.find(
      (where: { groupMasterFolio?: { propertyId: string }; businessDate?: unknown; receivedAt?: unknown }) =>
        where.groupMasterFolio?.propertyId === propertyId &&
        where.businessDate &&
        !where.receivedAt,
    );
    expect(groupBusinessDateBranch).toBeDefined();
    expect(result.totalPayments).toBe(600);
  });

  it('excludes group payments from another property by query ownership scope', async () => {
    const paymentsRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    await service.getRevenue(propertyId, parseReportRange('2026-07-05', '2026-07-05'), occupancy);

    const paymentWhere = paymentsRepository.find.mock.calls[0][0].where;
    expect(paymentWhere).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupMasterFolio: { propertyId } }),
      ]),
    );
    expect(paymentWhere).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupMasterFolio: { propertyId: 'other-property-id' } }),
      ]),
    );
  });

  it('does not duplicate-count a group payment in payment totals or method breakdown', async () => {
    const paymentsRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'group-payment-1',
          groupMasterFolioId: 'group-folio-1',
          folioId: null,
          method: FolioPaymentMethod.CARD,
          amount: '700.00',
        },
      ]),
    };
    const service = new RevenueReportService(
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      asRepository(paymentsRepository),
    );

    const result = await service.getRevenue(
      propertyId,
      parseReportRange('2026-07-04', '2026-07-04'),
      occupancy,
    );

    expect(paymentsRepository.find.mock.calls[0][0].where).toHaveLength(4);
    expect(result.totalPayments).toBe(700);
    expect(result.byPaymentMethod).toEqual([{ label: FolioPaymentMethod.CARD, value: 700 }]);
  });
});

describe('OperationsReportService', () => {
  it('computes request operations metrics', async () => {
    const reservationsRepository = {
      count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(3),
    };
    const requestsRepository = {
      find: jest.fn().mockResolvedValue([
        {
          status: GuestRequestStatus.REQUESTED,
          dueAt: new Date(Date.now() - 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          status: GuestRequestStatus.COMPLETED,
          dueAt: null,
          createdAt: new Date('2026-07-01T10:00:00Z'),
          completedAt: new Date('2026-07-01T10:30:00Z'),
          updatedAt: new Date(),
        },
      ]),
    };
    const service = new OperationsReportService(
      asRepository(reservationsRepository),
      asRepository(requestsRepository),
    );
    await expect(
      service.getOperations(propertyId, parseReportRange('2026-07-01', '2026-07-10')),
    ).resolves.toMatchObject({
      arrivals: 4,
      departures: 3,
      openRequests: 1,
      completedRequests: 1,
      overdueRequests: 1,
      avgRequestResolutionMinutes: 30,
    });
  });

  it('scopes operations queries to property', async () => {
    const reservationsRepository = { count: jest.fn().mockResolvedValue(0) };
    const requestsRepository = { find: jest.fn().mockResolvedValue([]) };
    const service = new OperationsReportService(
      asRepository(reservationsRepository),
      asRepository(requestsRepository),
    );
    await service.getOperations(propertyId, parseReportRange('2026-07-01', '2026-07-10'));
    expect(requestsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propertyId }),
      }),
    );
  });
});
