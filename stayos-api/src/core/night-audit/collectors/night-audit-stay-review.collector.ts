import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import {
  NightAuditActionDto,
  NightAuditStayReviewItemDto,
  NightAuditStayReviewSectionDto,
  NightAuditStayReviewState,
} from '../dto/night-audit-workspace.dto';

const REVIEW_STATE_PRIORITY: Record<NightAuditStayReviewState, number> = {
  [NightAuditStayReviewState.OVERDUE]: 1,
  [NightAuditStayReviewState.DUE_OUT]: 2,
  [NightAuditStayReviewState.STAYOVER]: 3,
};

export function classifyStayReview(
  departureDate: string,
  businessDate: string,
): NightAuditStayReviewState {
  if (departureDate > businessDate) {
    return NightAuditStayReviewState.STAYOVER;
  }
  if (departureDate < businessDate) {
    return NightAuditStayReviewState.OVERDUE;
  }
  return NightAuditStayReviewState.DUE_OUT;
}

@Injectable()
export class NightAuditStayReviewCollector {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationRepository: Repository<ReservationEntity>,
  ) {}

  /**
   * Collects and classifies in-house (CHECKED_IN) reservations for the specified property
   * against the authoritative NightAuditRun businessDate.
   *
   * Invariants:
   * - Queries ONLY reservation.status = CHECKED_IN scoped by propertyId.
   * - Does not infer occupancy from roomId (unassigned checked-in stays appear with roomAssignmentMissing: true).
   * - Overdue departures (departureDate < businessDate) are authoritatively included and marked BLOCKING.
   * - Uses businessDate as the sole date boundary (pure string comparison; zero wall-clock usage).
   * - Deterministic ordering: OVERDUE -> DUE_OUT -> STAYOVER; within each category, departureDate ASC, roomNumber/id ASC.
   * - blockingCount = dueOut + overdue (STAYOVER is non-blocking).
   */
  async collect(
    propertyId: string,
    businessDate: string,
  ): Promise<NightAuditStayReviewSectionDto> {
    const reservations = await this.reservationRepository.find({
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

    let stayover = 0;
    let dueOut = 0;
    let overdue = 0;

    const items: NightAuditStayReviewItemDto[] = reservations.map((reservation) => {
      const reviewState = classifyStayReview(reservation.departureDate, businessDate);
      const blocking =
        reviewState === NightAuditStayReviewState.DUE_OUT ||
        reviewState === NightAuditStayReviewState.OVERDUE;

      if (reviewState === NightAuditStayReviewState.STAYOVER) {
        stayover++;
      } else if (reviewState === NightAuditStayReviewState.DUE_OUT) {
        dueOut++;
      } else {
        overdue++;
      }

      const guestName =
        reservation.guest?.displayName?.trim() ||
        [reservation.guest?.firstName, reservation.guest?.lastName].filter(Boolean).join(' ').trim() ||
        'Unknown Guest';

      const isRoomMissing = reservation.roomId == null;

      return {
        reservationId: reservation.id,
        confirmationNumber: reservation.reservationCode,
        reservationCode: reservation.reservationCode,
        guestId: reservation.guestId ?? reservation.guest?.id ?? null,
        guestName,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        roomId: reservation.roomId ?? null,
        roomNumber: reservation.room?.roomNumber ?? null,
        roomTypeId: reservation.roomTypeId ?? null,
        status: reservation.status,
        reviewState,
        blocking,
        roomAssignmentMissing: isRoomMissing,
        actions: this.resolveActions(reviewState),
      };
    });

    // Deterministic sort: OVERDUE (1) -> DUE_OUT (2) -> STAYOVER (3)
    // Within category: departureDate ASC, roomNumber ASC, reservationId ASC
    items.sort((a, b) => {
      const priorityDiff = REVIEW_STATE_PRIORITY[a.reviewState] - REVIEW_STATE_PRIORITY[b.reviewState];
      if (priorityDiff !== 0) return priorityDiff;

      const dateDiff = a.departureDate.localeCompare(b.departureDate);
      if (dateDiff !== 0) return dateDiff;

      const roomA = a.roomNumber ?? '';
      const roomB = b.roomNumber ?? '';
      const roomDiff = roomA.localeCompare(roomB, undefined, { numeric: true });
      if (roomDiff !== 0) return roomDiff;

      return a.reservationId.localeCompare(b.reservationId);
    });

    return {
      count: items.length,
      blockingCount: dueOut + overdue,
      summary: {
        stayover,
        dueOut,
        overdue,
      },
      items,
    };
  }

  /**
   * Exposes stable action metadata for existing StayOS workflows:
   * - DUE_OUT / OVERDUE: OPEN_STAY, EXTEND_STAY, CHECK_OUT
   * - STAYOVER: OPEN_STAY, EXTEND_STAY
   */
  private resolveActions(reviewState: NightAuditStayReviewState): NightAuditActionDto[] {
    const actions: NightAuditActionDto[] = [
      { type: 'OPEN_STAY' },
      { type: 'EXTEND_STAY' },
    ];

    if (
      reviewState === NightAuditStayReviewState.DUE_OUT ||
      reviewState === NightAuditStayReviewState.OVERDUE
    ) {
      actions.push({ type: 'CHECK_OUT' });
    }

    return actions;
  }
}
