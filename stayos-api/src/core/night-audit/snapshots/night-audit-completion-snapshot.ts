import type { NightAuditRunEntity } from '../infrastructure/night-audit-run.entity';
import { NightAuditValidationDto } from '../dto/night-audit-validation.dto';
import {
  NightAuditFolioExceptionType,
  NightAuditStayReviewState,
  NightAuditWorkspaceDto,
} from '../dto/night-audit-workspace.dto';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { GroupBookingStatus } from '../../operations/domain/group-booking-status.enum';

export const NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION = 'NA-V2.1' as const;

/**
 * V2.4 introduces an immutable manager-level FINANCIAL CLOSING SUMMARY captured
 * during the close transaction (after nightly posting, before finalization).
 * NA-V2.1 snapshots remain valid and are never rewritten.
 */
export const NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION = 'NA-V2.4' as const;

export type NightAuditCompletionSnapshotVersion =
  typeof NIGHT_AUDIT_COMPLETION_SNAPSHOT_VERSION;

export type NightAuditFinancialSnapshotVersion =
  typeof NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION;

export interface NightAuditFinancialSummaryFinancials {
  currency: string | null;
  roomRevenue: number;
  otherChargeRevenue: number;
  grossCharges: number;
  taxAmount: number;
  paymentsCollected: number;
  refunds: number;
  netCollections: number;
  outstandingBalance: number;
}

export interface NightAuditFinancialPaymentBreakdownEntry {
  method: string;
  amount: number;
}

export interface NightAuditFinancialOperationalSummary {
  totalRooms: number;
  inHouseRooms: number;
  stayovers: number;
  arrivals: number;
  departures: number;
  noShows: number;
}

export interface NightAuditFinancialGroupSummary {
  inHouseGroups: number;
  stayoverGroups: number;
  masterFolioPaymentsCollected: number;
  masterFolioRefunds: number;
  /** Group accommodation revenue is NOT unified into folio_charges and is
   * intentionally never fabricated as ROOM revenue. Master-folio payments only. */
  accommodationRevenueIncluded: false;
}

export interface NightAuditCompletionSnapshotFinancialSummary {
  financialSummary: NightAuditFinancialSummaryFinancials;
  paymentBreakdown: NightAuditFinancialPaymentBreakdownEntry[];
  operationalSummary: NightAuditFinancialOperationalSummary;
  groupSummary: NightAuditFinancialGroupSummary;
}

export interface NightAuditCompletionSnapshotSectionCounts {
  count: number;
  blockingCount: number;
}

export interface NightAuditCompletionSnapshotStayReviewSummary {
  stayover: number;
  dueOut: number;
  overdue: number;
}

export interface NightAuditCompletionSnapshotFolioExceptionsSummary {
  outstandingBalance: number;
  unsettledZeroBalance: number;
  missingFolio: number;
}

export interface NightAuditCompletionSnapshotGroupReviewSummary
  extends NightAuditCompletionSnapshotStayReviewSummary {
  financialExceptions: number;
  operationalExceptions: number;
}

export interface NightAuditCompletionSnapshotPendingArrivalRef {
  reservationId: string;
  confirmationNumber: string;
  reservationCode?: string;
  arrivalDate: string;
  status: ReservationStatus;
}

export interface NightAuditCompletionSnapshotStayReviewRef {
  reservationId: string;
  confirmationNumber: string;
  reservationCode?: string;
  departureDate: string;
  reviewState: NightAuditStayReviewState;
  roomId: string | null;
  roomNumber: string | null;
}

export interface NightAuditCompletionSnapshotFolioExceptionRef {
  reservationId: string;
  confirmationNumber: string;
  reservationCode?: string;
  folioId: string | null;
  exceptionType: NightAuditFolioExceptionType;
  blocking: boolean;
}

export interface NightAuditCompletionSnapshotGroupReviewRef {
  groupBookingId: string;
  groupCode: string;
  reviewState: NightAuditStayReviewState;
  assignedRoomCount: number;
  blocking: boolean;
}

export interface NightAuditCompletionSnapshotValidation {
  canClose: true;
  totalBlockingCount: 0;
  blockers: {
    pendingArrivals: 0;
    stayReview: 0;
    folioExceptions: 0;
    groupReview: 0;
  };
}

export interface NightAuditCompletionSnapshotSections {
  pendingArrivals: NightAuditCompletionSnapshotSectionCounts & {
    refs: NightAuditCompletionSnapshotPendingArrivalRef[];
  };
  stayReview: NightAuditCompletionSnapshotSectionCounts & {
    summary: NightAuditCompletionSnapshotStayReviewSummary;
    refs: NightAuditCompletionSnapshotStayReviewRef[];
  };
  folioExceptions: NightAuditCompletionSnapshotSectionCounts & {
    summary: NightAuditCompletionSnapshotFolioExceptionsSummary;
    refs: NightAuditCompletionSnapshotFolioExceptionRef[];
  };
  groupReview: NightAuditCompletionSnapshotSectionCounts & {
    summary: NightAuditCompletionSnapshotGroupReviewSummary;
    refs: NightAuditCompletionSnapshotGroupReviewRef[];
  };
}

export interface NightAuditCompletionSnapshotInHouseSummary {
  /**
   * Operational in-house counts from Night Audit lifecycle collectors.
   * These are not occupancy percentage, rooms sold, or occupied room counts.
   */
  individualInHouseCount: number;
  individualStayoverCount: number;
  groupInHouseCount: number;
  groupStayoverCount: number;
}

export interface NightAuditCompletionSnapshotV21 {
  version: NightAuditCompletionSnapshotVersion;
  propertyId: string;
  runId: string;
  businessDate: string;
  nextBusinessDate: string;
  startedAt: string;
  startedByUserId: string;
  completedAt: string;
  completedByUserId: string;
  validation: NightAuditCompletionSnapshotValidation;
  sections: NightAuditCompletionSnapshotSections;
  inHouseSummary: NightAuditCompletionSnapshotInHouseSummary;
}

/**
 * NA-V2.4 extends the immutable V2.1 operational snapshot additively with a
 * manager-level financial closing summary. Every V2.1 field is preserved.
 */
export interface NightAuditCompletionSnapshotV24
  extends Omit<NightAuditCompletionSnapshotV21, 'version'> {
  version: NightAuditFinancialSnapshotVersion;
  financial: NightAuditCompletionSnapshotFinancialSummary;
}

export type NightAuditCompletionSnapshot =
  | NightAuditCompletionSnapshotV21
  | NightAuditCompletionSnapshotV24;

export interface BuildNightAuditCompletionSnapshotInput {
  run: Pick<
    NightAuditRunEntity,
    'id' | 'propertyId' | 'businessDate' | 'startedAt' | 'startedByUserId'
  >;
  workspace: NightAuditWorkspaceDto;
  validation: NightAuditValidationDto;
  nextBusinessDate: string;
  completedAt: Date;
  actorUserId: string;
  financial: NightAuditCompletionSnapshotFinancialSummary;
}

export class NightAuditCompletionSnapshotBuilder {
  build(input: BuildNightAuditCompletionSnapshotInput): NightAuditCompletionSnapshotV24 {
    const { run, workspace, validation, nextBusinessDate, completedAt, actorUserId, financial } =
      input;

    if (validation.canClose !== true || validation.totalBlockingCount !== 0) {
      throw new Error(
        'Night Audit completion snapshot requires successful pre-close validation with zero blockers.',
      );
    }

    const blockers = validation.blockers;
    if (
      blockers.pendingArrivals !== 0 ||
      blockers.stayReview !== 0 ||
      blockers.folioExceptions !== 0 ||
      blockers.groupReview !== 0
    ) {
      throw new Error(
        'Night Audit completion snapshot requires every validation blocker section to be zero.',
      );
    }

    return {
      version: NIGHT_AUDIT_FINANCIAL_SNAPSHOT_VERSION,
      propertyId: run.propertyId,
      runId: run.id,
      businessDate: run.businessDate,
      nextBusinessDate,
      startedAt: run.startedAt.toISOString(),
      startedByUserId: run.startedByUserId,
      completedAt: completedAt.toISOString(),
      completedByUserId: actorUserId,
      validation: {
        canClose: true,
        totalBlockingCount: 0,
        blockers: {
          pendingArrivals: 0,
          stayReview: 0,
          folioExceptions: 0,
          groupReview: 0,
        },
      },
      sections: {
        pendingArrivals: {
          count: workspace.pendingArrivals.count,
          blockingCount: workspace.pendingArrivals.blockingCount,
          refs: workspace.pendingArrivals.items.map((item) => ({
            reservationId: item.reservationId,
            confirmationNumber: item.confirmationNumber,
            ...(item.reservationCode ? { reservationCode: item.reservationCode } : {}),
            arrivalDate: item.arrivalDate,
            status: item.status,
          })),
        },
        stayReview: {
          count: workspace.stayReview.count,
          blockingCount: workspace.stayReview.blockingCount,
          summary: {
            stayover: workspace.stayReview.summary.stayover,
            dueOut: workspace.stayReview.summary.dueOut,
            overdue: workspace.stayReview.summary.overdue,
          },
          refs: workspace.stayReview.items.map((item) => ({
            reservationId: item.reservationId,
            confirmationNumber: item.confirmationNumber,
            ...(item.reservationCode ? { reservationCode: item.reservationCode } : {}),
            departureDate: item.departureDate,
            reviewState: item.reviewState,
            roomId: item.roomId,
            roomNumber: item.roomNumber,
          })),
        },
        folioExceptions: {
          count: workspace.folioExceptions.count,
          blockingCount: workspace.folioExceptions.blockingCount,
          summary: {
            outstandingBalance: workspace.folioExceptions.summary.outstandingBalance,
            unsettledZeroBalance: workspace.folioExceptions.summary.unsettledZeroBalance,
            missingFolio: workspace.folioExceptions.summary.missingFolio,
          },
          refs: workspace.folioExceptions.items.map((item) => ({
            reservationId: item.reservationId,
            confirmationNumber: item.confirmationNumber,
            ...(item.reservationCode ? { reservationCode: item.reservationCode } : {}),
            folioId: item.folioId,
            exceptionType: item.exceptionType,
            blocking: item.blocking,
          })),
        },
        groupReview: {
          count: workspace.groupReview.count,
          blockingCount: workspace.groupReview.blockingCount,
          summary: {
            stayover: workspace.groupReview.summary.stayover,
            dueOut: workspace.groupReview.summary.dueOut,
            overdue: workspace.groupReview.summary.overdue,
            financialExceptions: workspace.groupReview.summary.financialExceptions,
            operationalExceptions: workspace.groupReview.summary.operationalExceptions,
          },
          refs: workspace.groupReview.items.map((item) => ({
            groupBookingId: item.groupBookingId,
            groupCode: item.groupCode,
            reviewState: item.reviewState,
            assignedRoomCount: item.assignedRoomCount,
            blocking: item.blocking,
          })),
        },
      },
      inHouseSummary: {
        individualInHouseCount: workspace.stayReview.count,
        individualStayoverCount: workspace.stayReview.summary.stayover,
        groupInHouseCount: workspace.groupReview.items.filter(
          (item) => item.groupBookingStatus === GroupBookingStatus.CHECKED_IN,
        ).length,
        groupStayoverCount: workspace.groupReview.summary.stayover,
      },
      financial,
    };
  }
}
