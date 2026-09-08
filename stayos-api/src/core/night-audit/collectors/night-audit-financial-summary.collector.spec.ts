import { EntityManager } from 'typeorm';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioPaymentMethod } from '../../billing/domain/folio-payment-method.enum';
import { FolioPaymentType } from '../../billing/domain/folio-payment-type.enum';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { FolioChargeEntity } from '../../billing/infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from '../../billing/infrastructure/folio-payment.entity';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { NightAuditWorkspaceDto } from '../dto/night-audit-workspace.dto';
import { NightAuditFinancialSummaryCollector } from './night-audit-financial-summary.collector';

const PROPERTY = 'prop-1';
const BUSINESS_DATE = '2026-09-04';

function charge(partial: Partial<FolioChargeEntity>): FolioChargeEntity {
  return {
    type: FolioChargeType.ROOM,
    amount: '0',
    taxAmount: '0',
    ...partial,
  } as FolioChargeEntity;
}

function payment(partial: Partial<FolioPaymentEntity>): FolioPaymentEntity {
  return {
    type: FolioPaymentType.PAYMENT,
    method: FolioPaymentMethod.CASH,
    amount: '0',
    folioId: 'folio-1',
    groupMasterFolioId: null,
    ...partial,
  } as FolioPaymentEntity;
}

function workspace(): NightAuditWorkspaceDto {
  return {
    pendingArrivals: { count: 0, blockingCount: 0, items: [] },
    stayReview: {
      count: 3,
      blockingCount: 0,
      summary: { stayover: 2, dueOut: 0, overdue: 0 },
      items: [],
    },
    folioExceptions: {
      count: 0,
      blockingCount: 0,
      summary: { outstandingBalance: 0, unsettledZeroBalance: 0, missingFolio: 0 },
      items: [],
    },
    groupReview: {
      count: 1,
      blockingCount: 0,
      summary: { stayover: 1, dueOut: 0, overdue: 0, financialExceptions: 0, operationalExceptions: 0 },
      items: [
        { groupBookingStatus: 'CHECKED_IN' } as never,
        { groupBookingStatus: 'CHECKED_OUT' } as never,
      ],
    },
  };
}

interface Fixtures {
  charges?: FolioChargeEntity[];
  payments?: FolioPaymentEntity[];
  openFolios?: FolioEntity[];
  totalRooms?: number;
  arrivals?: number;
  departures?: number;
  noShows?: number;
}

function makeManager(fixtures: Fixtures) {
  const chargeRepo = { find: jest.fn().mockResolvedValue(fixtures.charges ?? []) };
  const paymentRepo = { find: jest.fn().mockResolvedValue(fixtures.payments ?? []) };
  const folioRepo = { find: jest.fn().mockResolvedValue(fixtures.openFolios ?? []) };
  const roomRepo = { count: jest.fn().mockResolvedValue(fixtures.totalRooms ?? 0) };
  const reservationRepo = {
    count: jest
      .fn()
      // arrivals, departures, noShows are resolved via Promise.all order
      .mockResolvedValueOnce(fixtures.arrivals ?? 0)
      .mockResolvedValueOnce(fixtures.departures ?? 0)
      .mockResolvedValueOnce(fixtures.noShows ?? 0),
  };

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === FolioChargeEntity) return chargeRepo;
      if (entity === FolioPaymentEntity) return paymentRepo;
      if (entity === FolioEntity) return folioRepo;
      if (entity === RoomEntity) return roomRepo;
      if (entity === ReservationEntity) return reservationRepo;
      throw new Error(`Unexpected entity: ${String(entity)}`);
    },
  } as unknown as EntityManager;

  return { manager, chargeRepo, paymentRepo, folioRepo, roomRepo, reservationRepo };
}

describe('NightAuditFinancialSummaryCollector', () => {
  const collector = new NightAuditFinancialSummaryCollector();

  it('aggregates room vs other charges and tax for the business date', async () => {
    const { manager } = makeManager({
      charges: [
        charge({ type: FolioChargeType.ROOM, amount: '5000.00', taxAmount: '600.00' }),
        charge({ type: FolioChargeType.FOOD_AND_BEVERAGE, amount: '1200.00', taxAmount: '60.00' }),
        charge({ type: FolioChargeType.MINIBAR, amount: '300.00', taxAmount: '15.00' }),
      ],
    });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    expect(result.financialSummary.roomRevenue).toBe(5000);
    expect(result.financialSummary.otherChargeRevenue).toBe(1500);
    expect(result.financialSummary.taxAmount).toBe(675);
    expect(result.financialSummary.grossCharges).toBe(5000 + 1500 + 675);
    expect(result.financialSummary.currency).toBe('INR');
  });

  it('nets reversal charge rows (original + reversal = 0)', async () => {
    const { manager } = makeManager({
      charges: [
        charge({ type: FolioChargeType.ROOM, amount: '5000.00', taxAmount: '600.00' }),
        charge({ type: FolioChargeType.ROOM, amount: '-5000.00', taxAmount: '-600.00' }),
      ],
    });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    expect(result.financialSummary.roomRevenue).toBe(0);
    expect(result.financialSummary.taxAmount).toBe(0);
    expect(result.financialSummary.grossCharges).toBe(0);
  });

  it('computes payments, refunds and net collections', async () => {
    const { manager } = makeManager({
      payments: [
        payment({ type: FolioPaymentType.PAYMENT, method: FolioPaymentMethod.CASH, amount: '3000.00' }),
        payment({ type: FolioPaymentType.PAYMENT, method: FolioPaymentMethod.CARD, amount: '2000.00' }),
        payment({ type: FolioPaymentType.REFUND, method: FolioPaymentMethod.CARD, amount: '-500.00' }),
      ],
    });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    expect(result.financialSummary.paymentsCollected).toBe(5000);
    expect(result.financialSummary.refunds).toBe(500);
    expect(result.financialSummary.netCollections).toBe(4500);
  });

  it('breaks payments down by method (net of refunds per method)', async () => {
    const { manager } = makeManager({
      payments: [
        payment({ method: FolioPaymentMethod.CASH, amount: '1500.00' }),
        payment({ method: FolioPaymentMethod.CARD, amount: '2000.00' }),
        payment({ method: FolioPaymentMethod.UPI, amount: '1000.00' }),
        payment({ type: FolioPaymentType.REFUND, method: FolioPaymentMethod.CARD, amount: '-500.00' }),
      ],
    });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    const breakdown = Object.fromEntries(result.paymentBreakdown.map((e) => [e.method, e.amount]));
    expect(breakdown).toEqual({ CASH: 1500, CARD: 1500, UPI: 1000 });
  });

  it('computes outstanding balance across OPEN folios post-posting', async () => {
    const openFolios = [
      {
        status: FolioStatus.OPEN,
        charges: [charge({ amount: '5000.00', taxAmount: '0.00' })],
        payments: [payment({ amount: '2000.00' })],
      } as unknown as FolioEntity,
    ];
    const { manager } = makeManager({ openFolios });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    expect(result.financialSummary.outstandingBalance).toBe(3000);
  });

  it('scopes every query to the property (isolation) and the business date', async () => {
    const { manager, chargeRepo, paymentRepo, folioRepo, roomRepo } = makeManager({});

    await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    expect(chargeRepo.find.mock.calls[0][0].where[0].folio.propertyId).toBe(PROPERTY);
    expect(paymentRepo.find.mock.calls[0][0].where[0].folio.propertyId).toBe(PROPERTY);
    expect(folioRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { propertyId: PROPERTY, status: FolioStatus.OPEN } }),
    );
    expect(roomRepo.count).toHaveBeenCalledWith({ where: { propertyId: PROPERTY } });
  });

  it('reports operational counts (rooms, arrivals, departures, no-shows, in-house, stayovers)', async () => {
    const { manager } = makeManager({ totalRooms: 40, arrivals: 5, departures: 3, noShows: 1 });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    expect(result.operationalSummary).toEqual({
      totalRooms: 40,
      inHouseRooms: 3,
      stayovers: 2,
      arrivals: 5,
      departures: 3,
      noShows: 1,
    });
  });

  it('counts group master-folio payments once and never fabricates group accommodation revenue', async () => {
    const { manager } = makeManager({
      charges: [charge({ type: FolioChargeType.ROOM, amount: '5000.00', taxAmount: '0.00' })],
      payments: [
        payment({ method: FolioPaymentMethod.CARD, amount: '2000.00', folioId: 'folio-1', groupMasterFolioId: null }),
        payment({
          method: FolioPaymentMethod.BANK_TRANSFER,
          amount: '8000.00',
          folioId: null,
          groupMasterFolioId: 'gmf-1',
        }),
      ],
    });

    const result = await collector.collect(manager, PROPERTY, BUSINESS_DATE, workspace(), 'INR');

    // group master payment appears in totals exactly once (no double count)
    expect(result.financialSummary.paymentsCollected).toBe(10000);
    expect(result.groupSummary.masterFolioPaymentsCollected).toBe(8000);
    expect(result.groupSummary.masterFolioRefunds).toBe(0);
    // group room revenue is NOT folded into room revenue
    expect(result.financialSummary.roomRevenue).toBe(5000);
    expect(result.groupSummary.accommodationRevenueIncluded).toBe(false);
    expect(result.groupSummary.inHouseGroups).toBe(1);
    expect(result.groupSummary.stayoverGroups).toBe(1);
  });
});
