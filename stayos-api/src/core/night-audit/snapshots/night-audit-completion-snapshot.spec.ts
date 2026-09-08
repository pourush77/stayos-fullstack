import { GroupBookingStatus } from '../../operations/domain/group-booking-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { NightAuditValidationDto } from '../dto/night-audit-validation.dto';
import {
  NightAuditFolioExceptionType,
  NightAuditStayReviewState,
  NightAuditWorkspaceDto,
} from '../dto/night-audit-workspace.dto';
import {
  NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION,
  NightAuditCompletionSnapshotBuilder,
  type NightAuditCompletionSnapshotFinancialSummary,
} from './night-audit-completion-snapshot';

function representativeFinancial(): NightAuditCompletionSnapshotFinancialSummary {
  return {
    financialSummary: {
      currency: 'INR',
      roomRevenue: 5000,
      otherChargeRevenue: 1200,
      grossCharges: 7316,
      taxAmount: 1116,
      paymentsCollected: 4000,
      refunds: 500,
      netCollections: 3500,
      outstandingBalance: 3816,
    },
    paymentBreakdown: [
      { method: 'CASH', amount: 1500 },
      { method: 'CARD', amount: 2000 },
    ],
    operationalSummary: {
      totalRooms: 40,
      inHouseRooms: 3,
      stayovers: 1,
      arrivals: 2,
      departures: 1,
      noShows: 0,
    },
    groupSummary: {
      inHouseGroups: 2,
      stayoverGroups: 1,
      masterFolioPaymentsCollected: 800,
      masterFolioRefunds: 0,
      accommodationRevenueIncluded: false,
    },
  };
}

const run = {
  id: 'run-1',
  propertyId: 'property-1',
  businessDate: '2026-09-06',
  startedAt: new Date('2026-09-06T18:30:00.000Z'),
  startedByUserId: 'starter-1',
};
const completedAt = new Date('2026-09-06T19:15:00.000Z');

describe('NightAuditCompletionSnapshotBuilder', () => {
  const builder = new NightAuditCompletionSnapshotBuilder();

  it('builds a deterministic NA-V2.4 snapshot from representative workspace', () => {
    const workspace = representativeWorkspace();
    const validation = successfulValidation();
    const input = {
      run,
      workspace,
      validation,
      nextBusinessDate: '2026-09-07',
      completedAt,
      actorUserId: 'closer-1',
      financial: representativeFinancial(),
    };

    expect(builder.build(input)).toEqual(builder.build(input));
    expect(builder.build(input).version).toBe(NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION);
  });

  it('maps identity, business dates, and actors from supplied inputs', () => {
    const snapshot = builder.build({
      run,
      workspace: representativeWorkspace(),
      validation: successfulValidation(),
      nextBusinessDate: '2026-09-07',
      completedAt,
      actorUserId: 'closer-1',
      financial: representativeFinancial(),
    });

    expect(snapshot).toMatchObject({
      propertyId: 'property-1',
      runId: 'run-1',
      businessDate: '2026-09-06',
      nextBusinessDate: '2026-09-07',
      startedAt: '2026-09-06T18:30:00.000Z',
      startedByUserId: 'starter-1',
      completedAt: '2026-09-06T19:15:00.000Z',
      completedByUserId: 'closer-1',
    });
  });

  it('maps section counts and classifications from workspace fields', () => {
    const snapshot = builder.build(baseInput());

    expect(snapshot.sections.pendingArrivals).toMatchObject({ count: 1, blockingCount: 0 });
    expect(snapshot.sections.stayReview.summary).toEqual({ stayover: 1, dueOut: 1, overdue: 1 });
    expect(snapshot.sections.folioExceptions.summary).toEqual({
      outstandingBalance: 1,
      unsettledZeroBalance: 1,
      missingFolio: 1,
    });
    expect(snapshot.sections.groupReview.summary).toEqual({
      stayover: 1,
      dueOut: 1,
      overdue: 0,
      financialExceptions: 1,
      operationalExceptions: 1,
    });
  });

  it('uses lifecycle collector outputs for in-house summary semantics', () => {
    const snapshot = builder.build(baseInput());

    expect(snapshot.inHouseSummary).toEqual({
      individualInHouseCount: 3,
      individualStayoverCount: 1,
      groupInHouseCount: 2,
      groupStayoverCount: 1,
    });
  });

  it('keeps compact refs to intended fields only', () => {
    const snapshot = builder.build(baseInput());

    expect(Object.keys(snapshot.sections.pendingArrivals.refs[0]).sort()).toEqual([
      'arrivalDate',
      'confirmationNumber',
      'reservationCode',
      'reservationId',
      'status',
    ]);
    expect(Object.keys(snapshot.sections.stayReview.refs[0]).sort()).toEqual([
      'confirmationNumber',
      'departureDate',
      'reservationCode',
      'reservationId',
      'reviewState',
      'roomId',
      'roomNumber',
    ]);
    expect(Object.keys(snapshot.sections.folioExceptions.refs[0]).sort()).toEqual([
      'blocking',
      'confirmationNumber',
      'exceptionType',
      'folioId',
      'reservationCode',
      'reservationId',
    ]);
    expect(Object.keys(snapshot.sections.groupReview.refs[0]).sort()).toEqual([
      'assignedRoomCount',
      'blocking',
      'groupBookingId',
      'groupCode',
      'reviewState',
    ]);
  });

  it('embeds the NA-V2.4 financial closing summary verbatim from input', () => {
    const financial = representativeFinancial();
    const snapshot = builder.build({ ...baseInput(), financial });

    expect(snapshot.financial).toEqual(financial);
    expect(snapshot.financial.groupSummary.accommodationRevenueIncluded).toBe(false);
  });

  it('refuses to build when close validation contains blockers', () => {
    const validation = successfulValidation();
    validation.canClose = false;
    validation.totalBlockingCount = 1;
    validation.blockers.stayReview = 1;

    expect(() =>
      builder.build({
        ...baseInput(),
        validation,
      }),
    ).toThrow(/zero blockers/);
  });

  it('does not mutate input objects', () => {
    const input = baseInput();
    const before = JSON.stringify(input);

    builder.build(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});

function baseInput() {
  return {
    run,
    workspace: representativeWorkspace(),
    validation: successfulValidation(),
    nextBusinessDate: '2026-09-07',
    completedAt,
    actorUserId: 'closer-1',
    financial: representativeFinancial(),
  };
}

function successfulValidation(): NightAuditValidationDto {
  return {
    canClose: true,
    totalBlockingCount: 0,
    blockers: {
      pendingArrivals: 0,
      stayReview: 0,
      folioExceptions: 0,
      groupReview: 0,
    },
    reasons: [],
  };
}

function representativeWorkspace(): NightAuditWorkspaceDto {
  return {
    pendingArrivals: {
      count: 1,
      blockingCount: 0,
      items: [
        {
          reservationId: 'reservation-arrival-1',
          confirmationNumber: 'HS-1001',
          reservationCode: 'RES-1001',
          guestId: 'guest-1',
          guestName: 'Asha Mehta',
          arrivalDate: '2026-09-06',
          departureDate: '2026-09-08',
          status: ReservationStatus.CHECKED_IN,
          roomId: 'room-1',
          roomNumber: '101',
          roomTypeId: 'room-type-1',
          actions: [{ type: 'OPEN_RESERVATION' }],
        },
      ],
    },
    stayReview: {
      count: 3,
      blockingCount: 0,
      summary: { stayover: 1, dueOut: 1, overdue: 1 },
      items: [
        stayReviewItem('reservation-stayover-1', 'RES-2001', NightAuditStayReviewState.STAYOVER),
        stayReviewItem('reservation-dueout-1', 'RES-2002', NightAuditStayReviewState.DUE_OUT),
        stayReviewItem('reservation-overdue-1', 'RES-2003', NightAuditStayReviewState.OVERDUE),
      ],
    },
    folioExceptions: {
      count: 3,
      blockingCount: 0,
      summary: { outstandingBalance: 1, unsettledZeroBalance: 1, missingFolio: 1 },
      items: [
        folioExceptionItem(
          'reservation-folio-1',
          'RES-3001',
          'folio-1',
          NightAuditFolioExceptionType.OUTSTANDING_BALANCE,
        ),
        folioExceptionItem(
          'reservation-folio-2',
          'RES-3002',
          'folio-2',
          NightAuditFolioExceptionType.UNSETTLED_ZERO_BALANCE,
        ),
        folioExceptionItem(
          'reservation-folio-3',
          'RES-3003',
          null,
          NightAuditFolioExceptionType.MISSING_FOLIO,
        ),
      ],
    },
    groupReview: {
      count: 2,
      blockingCount: 0,
      summary: {
        stayover: 1,
        dueOut: 1,
        overdue: 0,
        financialExceptions: 1,
        operationalExceptions: 1,
      },
      items: [
        groupReviewItem('group-1', 'GRP-1001', NightAuditStayReviewState.STAYOVER, 2),
        groupReviewItem('group-2', 'GRP-1002', NightAuditStayReviewState.DUE_OUT, 1),
      ],
    },
  };
}

function stayReviewItem(
  reservationId: string,
  reservationCode: string,
  reviewState: NightAuditStayReviewState,
) {
  return {
    reservationId,
    confirmationNumber: reservationCode,
    reservationCode,
    guestId: 'guest-2',
    guestName: 'Guest Name',
    arrivalDate: '2026-09-05',
    departureDate: '2026-09-07',
    roomId: 'room-2',
    roomNumber: '102',
    roomTypeId: 'room-type-2',
    status: ReservationStatus.CHECKED_IN,
    reviewState,
    blocking: false,
    roomAssignmentMissing: false,
    actions: [{ type: 'OPEN_STAY' }],
  };
}

function folioExceptionItem(
  reservationId: string,
  reservationCode: string,
  folioId: string | null,
  exceptionType: NightAuditFolioExceptionType,
) {
  return {
    reservationId,
    confirmationNumber: reservationCode,
    reservationCode,
    guestId: 'guest-3',
    guestName: 'Folio Guest',
    departureDate: '2026-09-07',
    roomId: 'room-3',
    roomNumber: '103',
    folioId,
    folioStatus: null,
    stayReviewState: NightAuditStayReviewState.STAYOVER,
    totalCharges: '1000.00',
    totalPayments: '1000.00',
    totalRefunds: '0.00',
    balanceDue: '0.00',
    exceptionType,
    blocking: false,
    actions: [{ type: 'OPEN_FOLIO' }],
  };
}

function groupReviewItem(
  groupBookingId: string,
  groupCode: string,
  reviewState: NightAuditStayReviewState,
  assignedRoomCount: number,
) {
  return {
    groupBookingId,
    groupCode,
    groupName: 'Conference Group',
    leadGuestName: 'Lead Guest',
    leadName: 'Lead Guest',
    arrivalDate: '2026-09-05',
    departureDate: '2026-09-07',
    groupBookingStatus: GroupBookingStatus.CHECKED_IN,
    groupStayStatus: 'IN_HOUSE',
    reviewState,
    assignedRoomCount,
    assignedRooms: [{ roomId: 'room-4', roomNumber: '104' }],
    roomAssignmentMissing: false,
    masterFolioId: 'master-folio-1',
    masterFolioStatus: 'OPEN',
    totalCharges: 1000,
    estimatedTotal: 1000,
    totalPayments: 1000,
    totalPaid: 1000,
    balanceDue: 0,
    checkoutEligible: true,
    financialException: reviewState === NightAuditStayReviewState.DUE_OUT,
    operationalException: reviewState === NightAuditStayReviewState.STAYOVER,
    blocking: false,
    actions: [{ type: 'OPEN_GROUP' }],
  };
}
