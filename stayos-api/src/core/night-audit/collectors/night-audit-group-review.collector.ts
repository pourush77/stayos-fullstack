import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FolioPaymentEntity } from '../../billing/infrastructure/folio-payment.entity';
import { GroupBookingStatus } from '../../operations/domain/group-booking-status.enum';
import { GroupBookingRoomAssignmentEntity } from '../../operations/infrastructure/group-booking-room-assignment.entity';
import { GroupMasterFolioEntity } from '../../operations/infrastructure/group-master-folio.entity';
import { GroupStayEntity } from '../../operations/infrastructure/group-stay.entity';
import {
  NightAuditActionDto,
  NightAuditGroupReviewAssignedRoomDto,
  NightAuditGroupReviewItemDto,
  NightAuditGroupReviewSectionDto,
  NightAuditStayReviewState,
} from '../dto/night-audit-workspace.dto';
import { classifyStayReview } from './night-audit-stay-review.collector';

const REVIEW_STATE_PRIORITY: Record<NightAuditStayReviewState, number> = {
  [NightAuditStayReviewState.OVERDUE]: 1,
  [NightAuditStayReviewState.DUE_OUT]: 2,
  [NightAuditStayReviewState.STAYOVER]: 3,
};

@Injectable()
export class NightAuditGroupReviewCollector {
  constructor(
    @InjectRepository(GroupStayEntity)
    private readonly groupStaysRepository: Repository<GroupStayEntity>,
    @InjectRepository(GroupBookingRoomAssignmentEntity)
    private readonly roomAssignmentsRepository: Repository<GroupBookingRoomAssignmentEntity>,
    @InjectRepository(GroupMasterFolioEntity)
    private readonly groupMasterFoliosRepository: Repository<GroupMasterFolioEntity>,
    @InjectRepository(FolioPaymentEntity)
    private readonly folioPaymentsRepository: Repository<FolioPaymentEntity>,
  ) {}

  /**
   * Collects and classifies authoritatively currently in-house groups for the specified property
   * against the authoritative NightAuditRun businessDate.
   *
   * Architectural Invariants:
   * - StayOS groups do NOT create child ReservationEntity rows.
   * - In-house group authority: GroupBooking.status === CHECKED_IN AND GroupStay.status === 'IN_HOUSE'.
   * - Does NOT infer in-house state from room assignments.
   * - Uses run.businessDate as the sole date boundary (zero wall-clock usage).
   * - Read-only: performs no writes, no status updates, no date advancement.
   * - Deterministic sorting: OVERDUE (1) -> DUE_OUT (2) -> STAYOVER (3), then departureDate ASC, groupCode ASC, groupBookingId ASC.
   */
  async collect(
    propertyId: string,
    businessDate: string,
  ): Promise<NightAuditGroupReviewSectionDto> {
    const stays = await this.groupStaysRepository.find({
      where: {
        propertyId,
        status: 'IN_HOUSE',
      },
      relations: {
        groupBooking: true,
      },
      order: {
        checkedInAt: 'ASC',
        id: 'ASC',
      },
    });

    // Authoritative in-house filter:
    // GroupBooking status = CHECKED_IN AND GroupStay status = IN_HOUSE
    // Strict property scoping on both stay and booking
    const inHouseStays = stays.filter(
      (stay) =>
        stay.propertyId === propertyId &&
        stay.status === 'IN_HOUSE' &&
        stay.groupBooking != null &&
        stay.groupBooking.propertyId === propertyId &&
        stay.groupBooking.status === GroupBookingStatus.CHECKED_IN,
    );

    if (inHouseStays.length === 0) {
      return {
        count: 0,
        blockingCount: 0,
        summary: {
          stayover: 0,
          dueOut: 0,
          overdue: 0,
          financialExceptions: 0,
          operationalExceptions: 0,
        },
        items: [],
      };
    }

    const groupBookingIds = inHouseStays.map((s) => s.groupBookingId);

    const [folios, assignments] = await Promise.all([
      this.groupMasterFoliosRepository.find({
        where: {
          propertyId,
          groupBookingId: In(groupBookingIds),
        },
      }),
      this.roomAssignmentsRepository.find({
        where: {
          groupBookingId: In(groupBookingIds),
        },
        relations: {
          room: true,
        },
      }),
    ]);

    const folioByGroupBookingId = new Map<string, GroupMasterFolioEntity>();
    for (const folio of folios) {
      folioByGroupBookingId.set(folio.groupBookingId, folio);
    }

    const folioIds = folios.map((f) => f.id).filter(Boolean);
    const payments =
      folioIds.length > 0
        ? await this.folioPaymentsRepository.find({
            where: {
              groupMasterFolioId: In(folioIds),
            },
            order: {
              receivedAt: 'ASC',
              createdAt: 'ASC',
            },
          })
        : [];

    const paymentsByFolioId = new Map<string, FolioPaymentEntity[]>();
    for (const payment of payments) {
      if (payment.groupMasterFolioId) {
        const list = paymentsByFolioId.get(payment.groupMasterFolioId) ?? [];
        list.push(payment);
        paymentsByFolioId.set(payment.groupMasterFolioId, list);
      }
    }

    const assignmentsByGroupBookingId = new Map<string, GroupBookingRoomAssignmentEntity[]>();
    for (const assignment of assignments) {
      const list = assignmentsByGroupBookingId.get(assignment.groupBookingId) ?? [];
      list.push(assignment);
      assignmentsByGroupBookingId.set(assignment.groupBookingId, list);
    }

    let stayoverCount = 0;
    let dueOutCount = 0;
    let overdueCount = 0;
    let financialExceptionsCount = 0;
    let operationalExceptionsCount = 0;
    let blockingCount = 0;

    const items: NightAuditGroupReviewItemDto[] = [];

    for (const stay of inHouseStays) {
      const group = stay.groupBooking;
      const folio = folioByGroupBookingId.get(group.id);
      const groupAssignments = assignmentsByGroupBookingId.get(group.id) ?? [];
      const groupPayments = folio ? (paymentsByFolioId.get(folio.id) ?? []) : [];

      // 1. Business-date classification using run.businessDate only:
      const reviewState = classifyStayReview(group.departureDate, businessDate);
      const isStayover = reviewState === NightAuditStayReviewState.STAYOVER;
      const isDueOut = reviewState === NightAuditStayReviewState.DUE_OUT;
      const isOverdue = reviewState === NightAuditStayReviewState.OVERDUE;

      if (isStayover) stayoverCount++;
      else if (isDueOut) dueOutCount++;
      else overdueCount++;

      // 2. Room assignments
      const assignedRooms: NightAuditGroupReviewAssignedRoomDto[] = groupAssignments
        .map((a) => ({
          roomId: a.roomId,
          roomNumber: a.room?.roomNumber ?? 'Unknown',
        }))
        .sort((a, b) => {
          const numDiff = a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
          if (numDiff !== 0) return numDiff;
          return a.roomId.localeCompare(b.roomId);
        });

      const assignedRoomCount = assignedRooms.length;
      const roomAssignmentMissing = assignedRoomCount === 0;

      // 3. Authoritative group master folio financial truth
      const existingCharges =
        (folio as unknown as { charges?: Array<{ amount: number }> })?.charges ?? [];
      const extraCharges = existingCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const estimatedTotal = Number(folio?.estimatedTotal || group.estimatedTotal || 0);
      const totalCharges = Number((estimatedTotal + extraCharges).toFixed(2));
      const totalPaid = Number(
        groupPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2),
      );
      const rawBalance = Math.max(totalCharges - totalPaid, 0);
      const balanceDue = Number(rawBalance.toFixed(2));

      // 4. Checkout eligibility (aligned with GroupBookingService rules)
      const hasFolio = folio != null;
      const hasPositiveBalance = balanceDue > 0.01;
      const isGroupActive =
        group.status !== GroupBookingStatus.RELEASED &&
        group.status !== GroupBookingStatus.CANCELLED;

      const checkoutEligible =
        hasFolio &&
        assignedRoomCount > 0 &&
        isGroupActive &&
        !hasPositiveBalance;

      // 5. Operational exception:
      // In-house group with zero assigned rooms is an operational inconsistency.
      // Overdue stay is an operational departure exception.
      const operationalException = roomAssignmentMissing || isOverdue;
      if (operationalException) operationalExceptionsCount++;

      // 6. Financial exception:
      // Missing required master folio (structural corruption).
      // Outstanding balance.
      // Unsettled / not checkout eligible for DUE_OUT or OVERDUE.
      const financialException = !hasFolio || hasPositiveBalance || (!isStayover && !checkoutEligible);
      if (financialException) financialExceptionsCount++;

      // 7. Blocking logic:
      // Operational:
      // - DUE_OUT blocks
      // - OVERDUE blocks
      // - roomAssignmentMissing blocks (even for STAYOVER)
      const operationalBlocking = isDueOut || isOverdue || roomAssignmentMissing;

      // Financial:
      // - Missing required master folio blocks (even for STAYOVER)
      // - For DUE_OUT / OVERDUE: positive balance blocks
      // - For DUE_OUT / OVERDUE: not checkout-eligible blocks
      // For STAYOVER: positive balance is informational / non-blocking
      const financialBlocking = !hasFolio || (!isStayover && (hasPositiveBalance || !checkoutEligible));

      const blocking = operationalBlocking || financialBlocking;
      if (blocking) blockingCount++;

      const actions = this.resolveActions(reviewState, hasFolio);

      items.push({
        groupBookingId: group.id,
        groupCode: group.groupCode,
        groupName: group.groupName,
        leadGuestName: group.leadName ?? null,
        leadName: group.leadName ?? null,
        arrivalDate: group.arrivalDate,
        departureDate: group.departureDate,
        groupBookingStatus: group.status,
        groupStayStatus: stay.status,
        reviewState,
        assignedRoomCount,
        assignedRooms,
        roomAssignmentMissing,
        masterFolioId: folio?.id ?? null,
        masterFolioStatus: folio?.status ?? null,
        totalCharges,
        estimatedTotal: totalCharges,
        totalPayments: totalPaid,
        totalPaid,
        balanceDue,
        checkoutEligible,
        financialException,
        operationalException,
        blocking,
        actions,
      });
    }

    // 8. Deterministic ordering:
    // Priority: OVERDUE (1) -> DUE_OUT (2) -> STAYOVER (3)
    // Secondary: departureDate ASC -> groupCode ASC -> groupBookingId ASC
    items.sort((a, b) => {
      const priorityDiff = REVIEW_STATE_PRIORITY[a.reviewState] - REVIEW_STATE_PRIORITY[b.reviewState];
      if (priorityDiff !== 0) return priorityDiff;

      const dateDiff = a.departureDate.localeCompare(b.departureDate);
      if (dateDiff !== 0) return dateDiff;

      const codeDiff = a.groupCode.localeCompare(b.groupCode);
      if (codeDiff !== 0) return codeDiff;

      return a.groupBookingId.localeCompare(b.groupBookingId);
    });

    return {
      count: items.length,
      blockingCount,
      summary: {
        stayover: stayoverCount,
        dueOut: dueOutCount,
        overdue: overdueCount,
        financialExceptions: financialExceptionsCount,
        operationalExceptions: operationalExceptionsCount,
      },
      items,
    };
  }

  /**
   * Resolves stable action metadata mapping to existing workflows:
   * - STAYOVER: OPEN_GROUP, OPEN_MASTER_FOLIO (if exists), EXTEND_GROUP_STAY
   * - DUE_OUT / OVERDUE: OPEN_GROUP, OPEN_MASTER_FOLIO (if exists), EXTEND_GROUP_STAY, CHECK_OUT_GROUP
   */
  private resolveActions(
    reviewState: NightAuditStayReviewState,
    hasMasterFolio: boolean,
  ): NightAuditActionDto[] {
    const actions: NightAuditActionDto[] = [{ type: 'OPEN_GROUP' }];

    if (hasMasterFolio) {
      actions.push({ type: 'OPEN_MASTER_FOLIO' });
    }

    actions.push({ type: 'EXTEND_GROUP_STAY' });

    if (
      reviewState === NightAuditStayReviewState.DUE_OUT ||
      reviewState === NightAuditStayReviewState.OVERDUE
    ) {
      actions.push({ type: 'CHECK_OUT_GROUP' });
    }

    return actions;
  }
}
