import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioChargeStatus } from '../../billing/domain/folio-charge-status.enum';
import { FolioPaymentMethod } from '../../billing/domain/folio-payment-method.enum';
import { FolioPaymentType } from '../../billing/domain/folio-payment-type.enum';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { FolioChargeEntity } from '../../billing/infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from '../../billing/infrastructure/folio-payment.entity';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import {
  NightAuditFolioExceptionType,
  NightAuditStayReviewState,
} from '../dto/night-audit-workspace.dto';
import { NightAuditFolioExceptionsCollector } from './night-audit-folio-exceptions.collector';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function mockFolio(partial: Partial<FolioEntity>): FolioEntity {
  return partial as unknown as FolioEntity;
}

function mockCharge(partial: Partial<FolioChargeEntity>): FolioChargeEntity {
  return partial as unknown as FolioChargeEntity;
}

function mockPayment(partial: Partial<FolioPaymentEntity>): FolioPaymentEntity {
  return partial as unknown as FolioPaymentEntity;
}

describe('NightAuditFolioExceptionsCollector', () => {
  let collector: NightAuditFolioExceptionsCollector;
  let reservationRepo: MockRepository<ReservationEntity>;
  let folioRepo: MockRepository<FolioEntity>;

  const propertyId = '11111111-1111-1111-1111-111111111111';
  const otherPropertyId = '22222222-2222-2222-2222-222222222222';
  const auditBusinessDate = '2026-09-04';

  beforeEach(async () => {
    reservationRepo = {
      find: jest.fn(),
    };
    folioRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NightAuditFolioExceptionsCollector,
        {
          provide: getRepositoryToken(ReservationEntity),
          useValue: reservationRepo,
        },
        {
          provide: getRepositoryToken(FolioEntity),
          useValue: folioRepo,
        },
      ],
    }).compile();

    collector = module.get<NightAuditFolioExceptionsCollector>(NightAuditFolioExceptionsCollector);
  });

  it('queries only CHECKED_IN reservations for propertyId and loads charges/payments on folios', async () => {
    reservationRepo.find?.mockResolvedValue([]);

    await collector.collect(propertyId, auditBusinessDate);

    expect(reservationRepo.find).toHaveBeenCalledWith({
      where: {
        propertyId,
        status: ReservationStatus.CHECKED_IN,
      },
      relations: {
        guest: true,
        room: true,
      },
      order: {
        departureDate: 'ASC',
        createdAt: 'ASC',
        id: 'ASC',
      },
    });
    expect(folioRepo.find).not.toHaveBeenCalled();
  });

  it('A. DUE_OUT with positive balance appears and BLOCKS', async () => {
    const resId = 'res-dueout-1';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-DO-1',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate, // DUE_OUT
        status: ReservationStatus.CHECKED_IN,
        roomId: 'room-1',
        room: { roomNumber: '101' },
        guest: { displayName: 'Due Out Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-1',
        propertyId,
        reservationId: resId,
        status: FolioStatus.OPEN,
        charges: [
          mockCharge({ amount: '1000.00', taxAmount: '120.00', status: FolioChargeStatus.POSTED }),
        ],
        payments: [],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(1);
    expect(result.blockingCount).toBe(1);
    expect(result.summary.outstandingBalance).toBe(1);

    const item = result.items[0];
    expect(item.reservationId).toBe(resId);
    expect(item.stayReviewState).toBe(NightAuditStayReviewState.DUE_OUT);
    expect(item.exceptionType).toBe(NightAuditFolioExceptionType.OUTSTANDING_BALANCE);
    expect(item.blocking).toBe(true);
    expect(item.totalCharges).toBe('1120.00');
    expect(item.totalPayments).toBe('0.00');
    expect(item.balanceDue).toBe('1120.00');
    expect(item.actions).toEqual([
      { type: 'OPEN_FOLIO' },
      { type: 'RECORD_PAYMENT' },
      { type: 'OPEN_STAY' },
    ]);
  });

  it('B. OVERDUE with positive balance appears and BLOCKS', async () => {
    const resId = 'res-overdue-1';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-OV-1',
        arrivalDate: '2026-08-30',
        departureDate: '2026-09-02', // OVERDUE
        status: ReservationStatus.CHECKED_IN,
        roomId: 'room-2',
        room: { roomNumber: '102' },
        guest: { displayName: 'Overdue Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-2',
        propertyId,
        reservationId: resId,
        status: FolioStatus.OPEN,
        charges: [
          mockCharge({ amount: '2000.00', taxAmount: '240.00', status: FolioChargeStatus.POSTED }),
        ],
        payments: [
          mockPayment({ amount: '1000.00', type: FolioPaymentType.PAYMENT }),
        ],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(1);
    expect(result.blockingCount).toBe(1);
    expect(result.summary.outstandingBalance).toBe(1);

    const item = result.items[0];
    expect(item.reservationId).toBe(resId);
    expect(item.stayReviewState).toBe(NightAuditStayReviewState.OVERDUE);
    expect(item.exceptionType).toBe(NightAuditFolioExceptionType.OUTSTANDING_BALANCE);
    expect(item.blocking).toBe(true);
    expect(item.totalCharges).toBe('2240.00');
    expect(item.totalPayments).toBe('1000.00');
    expect(item.balanceDue).toBe('1240.00');
  });

  it('C. STAYOVER with positive balance appears but does NOT block', async () => {
    const resId = 'res-stayover-1';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-SO-1',
        arrivalDate: '2026-09-02',
        departureDate: '2026-09-06', // STAYOVER
        status: ReservationStatus.CHECKED_IN,
        roomId: 'room-3',
        room: { roomNumber: '103' },
        guest: { displayName: 'Stayover Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-3',
        propertyId,
        reservationId: resId,
        status: FolioStatus.OPEN,
        charges: [
          mockCharge({ amount: '1500.00', taxAmount: '180.00', status: FolioChargeStatus.POSTED }),
        ],
        payments: [],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(1);
    expect(result.blockingCount).toBe(0); // Non-blocking
    expect(result.summary.outstandingBalance).toBe(1);

    const item = result.items[0];
    expect(item.reservationId).toBe(resId);
    expect(item.stayReviewState).toBe(NightAuditStayReviewState.STAYOVER);
    expect(item.exceptionType).toBe(NightAuditFolioExceptionType.OUTSTANDING_BALANCE);
    expect(item.blocking).toBe(false);
  });

  it('D. zero-balance properly settled folio does not appear as outstanding', async () => {
    const resId = 'res-settled-1';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-SETTLED',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
        guest: { displayName: 'Settled Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-settled',
        propertyId,
        reservationId: resId,
        status: FolioStatus.SETTLED, // Settled!
        charges: [
          mockCharge({ amount: '1000.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED }),
        ],
        payments: [
          mockPayment({ amount: '1000.00', type: FolioPaymentType.PAYMENT }),
        ],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(0);
    expect(result.blockingCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('E. other property reservation/folio does not appear', async () => {
    reservationRepo.find?.mockImplementation(async (options: any) => {
      if (options.where.propertyId === otherPropertyId) {
        return [
          {
            id: 'other-res',
            propertyId: otherPropertyId,
            status: ReservationStatus.CHECKED_IN,
            departureDate: auditBusinessDate,
          },
        ];
      }
      return [];
    });

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('F. non-CHECKED_IN reservation does not appear in collector query', async () => {
    reservationRepo.find?.mockImplementation(async (options: any) => {
      const allReservations = [
        { id: 'chkin', propertyId, status: ReservationStatus.CHECKED_IN, departureDate: auditBusinessDate },
        { id: 'chkout', propertyId, status: ReservationStatus.CHECKED_OUT, departureDate: auditBusinessDate },
        { id: 'conf', propertyId, status: ReservationStatus.CONFIRMED, departureDate: auditBusinessDate },
        { id: 'canc', propertyId, status: ReservationStatus.CANCELLED, departureDate: auditBusinessDate },
      ];
      return allReservations.filter(
        (r) => r.propertyId === options.where.propertyId && r.status === options.where.status,
      );
    });

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-chkin',
        propertyId,
        reservationId: 'chkin',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(1);
    expect(result.items[0].reservationId).toBe('chkin');
  });

  it('G. balance uses existing authoritative financial logic (cents-safe integer arithmetic)', async () => {
    const resId = 'res-calc';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-CALC',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
        guest: { displayName: 'Calc Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-calc',
        propertyId,
        reservationId: resId,
        status: FolioStatus.OPEN,
        charges: [
          mockCharge({ amount: '33.33', taxAmount: '9.00', status: FolioChargeStatus.POSTED }),
          mockCharge({ amount: '66.67', taxAmount: '9.00', status: FolioChargeStatus.POSTED }),
        ],
        payments: [
          mockPayment({ amount: '50.00', type: FolioPaymentType.PAYMENT }),
        ],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.items[0].totalCharges).toBe('118.00');
    expect(result.items[0].totalPayments).toBe('50.00');
    expect(result.items[0].balanceDue).toBe('68.00');
  });

  it('H. refunds, voids/reversals, and payments affect balance exactly as existing billing does', async () => {
    const resId = 'res-ledger';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-LEDGER',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
        guest: { displayName: 'Ledger Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-ledger',
        propertyId,
        reservationId: resId,
        status: FolioStatus.OPEN,
        charges: [
          mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED }),
          mockCharge({ amount: '200.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED }),
          mockCharge({ amount: '-200.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED }),
        ],
        payments: [
          mockPayment({ amount: '500.00', type: FolioPaymentType.PAYMENT }),
          mockPayment({ amount: '-100.00', type: FolioPaymentType.REFUND }),
        ],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    // Total charges: 500 + 200 - 200 = 500.00
    // Net paid: 500 - 100 = 400.00
    // Total refunds: 100.00
    // Balance due: 500 - 400 = 100.00
    expect(result.items[0].totalCharges).toBe('500.00');
    expect(result.items[0].totalPayments).toBe('400.00');
    expect(result.items[0].totalRefunds).toBe('100.00');
    expect(result.items[0].balanceDue).toBe('100.00');
    expect(result.items[0].exceptionType).toBe(NightAuditFolioExceptionType.OUTSTANDING_BALANCE);
  });

  it('I. missing folio behavior surfaces MISSING_FOLIO and blocks', async () => {
    const resId = 'res-no-folio';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-NO-FOLIO',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
        guest: { displayName: 'No Folio Guest' },
        createdAt: new Date(),
      },
    ]);

    // Folio repository returns empty
    folioRepo.find?.mockResolvedValue([]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(1);
    expect(result.blockingCount).toBe(1);
    expect(result.summary.missingFolio).toBe(1);

    const item = result.items[0];
    expect(item.reservationId).toBe(resId);
    expect(item.folioId).toBeNull();
    expect(item.folioStatus).toBeNull();
    expect(item.exceptionType).toBe(NightAuditFolioExceptionType.MISSING_FOLIO);
    expect(item.blocking).toBe(true);
    expect(item.actions).toEqual([{ type: 'OPEN_STAY' }]);
  });

  it('J-K. blockingCount and summary counts are accurate across mixed exception types', async () => {
    reservationRepo.find?.mockResolvedValue([
      // DUE_OUT with balance -> blocking outstanding
      {
        id: 'r1',
        propertyId,
        reservationCode: 'R1',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
      },
      // STAYOVER with balance -> non-blocking outstanding
      {
        id: 'r2',
        propertyId,
        reservationCode: 'R2',
        arrivalDate: '2026-09-01',
        departureDate: '2026-09-08',
        status: ReservationStatus.CHECKED_IN,
      },
      // DUE_OUT with 0 balance and OPEN folio -> blocking unsettled zero balance
      {
        id: 'r3',
        propertyId,
        reservationCode: 'R3',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
      },
      // Missing folio -> blocking missing folio
      {
        id: 'r4',
        propertyId,
        reservationCode: 'R4',
        arrivalDate: '2026-09-01',
        departureDate: '2026-09-06',
        status: ReservationStatus.CHECKED_IN,
      },
      // DUE_OUT with 0 balance and SETTLED folio -> properly settled, NO exception
      {
        id: 'r5',
        propertyId,
        reservationCode: 'R5',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'f1',
        propertyId,
        reservationId: 'r1',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [],
      }),
      mockFolio({
        id: 'f2',
        propertyId,
        reservationId: 'r2',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [],
      }),
      mockFolio({
        id: 'f3',
        propertyId,
        reservationId: 'r3',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [mockPayment({ amount: '500.00', type: FolioPaymentType.PAYMENT })],
      }),
      // r4 has no folio
      mockFolio({
        id: 'f5',
        propertyId,
        reservationId: 'r5',
        status: FolioStatus.SETTLED,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [mockPayment({ amount: '500.00', type: FolioPaymentType.PAYMENT })],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    // 4 exceptions (r1, r2, r3, r4)
    expect(result.count).toBe(4);
    // 3 blocking (r1 blocking outstanding, r3 blocking unsettled zero, r4 blocking missing folio; r2 is non-blocking)
    expect(result.blockingCount).toBe(3);
    expect(result.summary).toEqual({
      outstandingBalance: 2, // r1 and r2
      unsettledZeroBalance: 1, // r3
      missingFolio: 1, // r4
    });
  });

  it('L. run.businessDate is used as sole boundary for stay classification', async () => {
    const historicalDate = '2024-05-10';
    reservationRepo.find?.mockResolvedValue([
      {
        id: 'r-hist-do',
        propertyId,
        reservationCode: 'R-HIST',
        arrivalDate: '2024-05-01',
        departureDate: historicalDate,
        status: ReservationStatus.CHECKED_IN,
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'f-hist',
        propertyId,
        reservationId: 'r-hist-do',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '300.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [],
      }),
    ]);

    const result = await collector.collect(propertyId, historicalDate);

    expect(result.items[0].stayReviewState).toBe(NightAuditStayReviewState.DUE_OUT);
    expect(result.items[0].blocking).toBe(true);
  });

  it('M. collector is strictly read-only and performs zero database writes', async () => {
    reservationRepo.find?.mockResolvedValue([
      {
        id: 'r-ro',
        propertyId,
        reservationCode: 'R-RO',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
      },
    ]);
    folioRepo.find?.mockResolvedValue([]);

    await collector.collect(propertyId, auditBusinessDate);

    expect(reservationRepo.save).toBeUndefined();
    expect(folioRepo.save).toBeUndefined();
  });

  it('P. zero balance but legitimately unsettled/open folio is classified as UNSETTLED_ZERO_BALANCE', async () => {
    const resId = 'res-unsettled-zero';
    reservationRepo.find?.mockResolvedValue([
      {
        id: resId,
        propertyId,
        reservationCode: 'RES-UNSETTLED',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate, // DUE_OUT
        status: ReservationStatus.CHECKED_IN,
        guest: { displayName: 'Unsettled Zero Guest' },
        createdAt: new Date(),
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'folio-unsettled',
        propertyId,
        reservationId: resId,
        status: FolioStatus.OPEN, // OPEN folio with exactly zero balance
        charges: [mockCharge({ amount: '800.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [mockPayment({ amount: '800.00', type: FolioPaymentType.PAYMENT })],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    expect(result.count).toBe(1);
    expect(result.blockingCount).toBe(1);
    expect(result.summary.unsettledZeroBalance).toBe(1);

    const item = result.items[0];
    expect(item.exceptionType).toBe(NightAuditFolioExceptionType.UNSETTLED_ZERO_BALANCE);
    expect(item.balanceDue).toBe('0.00');
    expect(item.blocking).toBe(true);
  });

  it('Q. action metadata respects settlement eligibility (SETTLE_FOLIO only when balance is zero and folio OPEN)', async () => {
    reservationRepo.find?.mockResolvedValue([
      // r1 has outstanding balance > 0 -> cannot settle
      {
        id: 'r-due',
        propertyId,
        reservationCode: 'R-DUE',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
      },
      // r2 has zero balance and OPEN -> CAN settle
      {
        id: 'r-zero',
        propertyId,
        reservationCode: 'R-ZERO',
        arrivalDate: '2026-09-01',
        departureDate: auditBusinessDate,
        status: ReservationStatus.CHECKED_IN,
      },
    ]);

    folioRepo.find?.mockResolvedValue([
      mockFolio({
        id: 'f-due',
        propertyId,
        reservationId: 'r-due',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [],
      }),
      mockFolio({
        id: 'f-zero',
        propertyId,
        reservationId: 'r-zero',
        status: FolioStatus.OPEN,
        charges: [mockCharge({ amount: '500.00', taxAmount: '0.00', status: FolioChargeStatus.POSTED })],
        payments: [mockPayment({ amount: '500.00', type: FolioPaymentType.PAYMENT })],
      }),
    ]);

    const result = await collector.collect(propertyId, auditBusinessDate);

    const dueItem = result.items.find((i) => i.reservationId === 'r-due')!;
    const zeroItem = result.items.find((i) => i.reservationId === 'r-zero')!;

    // Outstanding balance: can record payment, CANNOT settle
    expect(dueItem.actions).toContainEqual({ type: 'RECORD_PAYMENT' });
    expect(dueItem.actions).not.toContainEqual({ type: 'SETTLE_FOLIO' });

    // Zero balance: CAN settle, cannot record payment
    expect(zeroItem.actions).toContainEqual({ type: 'SETTLE_FOLIO' });
    expect(zeroItem.actions).not.toContainEqual({ type: 'RECORD_PAYMENT' });
  });
});
