import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { calculateTotals } from '../../billing/billing.mapper';
import { fromCents, toCents } from '../../billing/domain/money';
import { FolioPaymentType } from '../../billing/domain/folio-payment-type.enum';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import {
  NightAuditActionDto,
  NightAuditFolioExceptionItemDto,
  NightAuditFolioExceptionsSectionDto,
  NightAuditFolioExceptionType,
  NightAuditStayReviewState,
} from '../dto/night-audit-workspace.dto';
import { classifyStayReview } from './night-audit-stay-review.collector';

const REVIEW_STATE_PRIORITY: Record<NightAuditStayReviewState, number> = {
  [NightAuditStayReviewState.OVERDUE]: 1,
  [NightAuditStayReviewState.DUE_OUT]: 2,
  [NightAuditStayReviewState.STAYOVER]: 3,
};

@Injectable()
export class NightAuditFolioExceptionsCollector {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationRepository: Repository<ReservationEntity>,
    @InjectRepository(FolioEntity)
    private readonly folioRepository: Repository<FolioEntity>,
  ) {}

  /**
   * Collects and evaluates financial exceptions for active in-house (CHECKED_IN)
   * stays against the authoritative NightAuditRun businessDate.
   *
   * Reuses the single source of truth for billing:
   * - `calculateTotals` and `toCents` / `fromCents` from BillingMapper / money helpers.
   * - Zero wall-clock usage: classifies stayReviewState via pure `classifyStayReview`.
   *
   * Exception Types:
   * - OUTSTANDING_BALANCE: balanceDue > 0
   *   - DUE_OUT / OVERDUE => BLOCKING
   *   - STAYOVER => NON-BLOCKING (informational)
   * - UNSETTLED_ZERO_BALANCE: balance == 0, folio OPEN, and departure expected (DUE_OUT / OVERDUE)
   *   - DUE_OUT / OVERDUE => BLOCKING
   * - MISSING_FOLIO: checked-in reservation without a folio
   *   - BLOCKING
   */
  async collect(
    propertyId: string,
    businessDate: string,
  ): Promise<NightAuditFolioExceptionsSectionDto> {
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

    if (reservations.length === 0) {
      return {
        count: 0,
        blockingCount: 0,
        summary: {
          outstandingBalance: 0,
          unsettledZeroBalance: 0,
          missingFolio: 0,
        },
        items: [],
      };
    }

    const reservationIds = reservations.map((r) => r.id);
    const folios = await this.folioRepository.find({
      where: {
        propertyId,
        reservationId: In(reservationIds),
      },
      relations: {
        charges: true,
        payments: true,
      },
    });

    const folioMap = new Map<string, FolioEntity>();
    for (const folio of folios) {
      folioMap.set(folio.reservationId, folio);
    }

    const items: NightAuditFolioExceptionItemDto[] = [];

    for (const reservation of reservations) {
      const stayReviewState = classifyStayReview(reservation.departureDate, businessDate);
      const guestName =
        reservation.guest?.displayName?.trim() ||
        [reservation.guest?.firstName, reservation.guest?.lastName].filter(Boolean).join(' ').trim() ||
        'Unknown Guest';

      const folio = folioMap.get(reservation.id);

      // Case A: Missing Folio
      if (!folio) {
        items.push({
          reservationId: reservation.id,
          confirmationNumber: reservation.reservationCode,
          reservationCode: reservation.reservationCode,
          guestId: reservation.guestId ?? reservation.guest?.id ?? null,
          guestName,
          departureDate: reservation.departureDate,
          roomId: reservation.roomId ?? null,
          roomNumber: reservation.room?.roomNumber ?? null,
          folioId: null,
          folioStatus: null,
          stayReviewState,
          totalCharges: '0.00',
          totalPayments: '0.00',
          totalRefunds: '0.00',
          balanceDue: '0.00',
          exceptionType: NightAuditFolioExceptionType.MISSING_FOLIO,
          blocking: true,
          actions: [{ type: 'OPEN_STAY' }],
        });
        continue;
      }

      // Compute authoritative financial totals
      const totals = calculateTotals(folio.charges ?? [], folio.payments ?? []);
      const balanceCents = toCents(totals.balance);

      const refundCents = (folio.payments ?? [])
        .filter((p) => p.type === FolioPaymentType.REFUND || toCents(p.amount) < 0)
        .reduce((sum, p) => sum + Math.abs(toCents(p.amount)), 0);
      const totalRefunds = fromCents(refundCents);

      // Case B: Outstanding Balance (balance > 0)
      if (balanceCents > 0) {
        const blocking =
          stayReviewState === NightAuditStayReviewState.DUE_OUT ||
          stayReviewState === NightAuditStayReviewState.OVERDUE;

        items.push({
          reservationId: reservation.id,
          confirmationNumber: reservation.reservationCode,
          reservationCode: reservation.reservationCode,
          guestId: reservation.guestId ?? reservation.guest?.id ?? null,
          guestName,
          departureDate: reservation.departureDate,
          roomId: reservation.roomId ?? null,
          roomNumber: reservation.room?.roomNumber ?? null,
          folioId: folio.id,
          folioStatus: folio.status,
          stayReviewState,
          totalCharges: totals.total,
          totalPayments: totals.paid,
          totalRefunds,
          balanceDue: totals.balance,
          exceptionType: NightAuditFolioExceptionType.OUTSTANDING_BALANCE,
          blocking,
          actions: this.resolveActions(
            NightAuditFolioExceptionType.OUTSTANDING_BALANCE,
            folio.status,
            balanceCents,
          ),
        });
      }
      // Case C: Zero Balance but Unsettled (balance == 0, folio OPEN)
      // Only an exception for DUE_OUT / OVERDUE where settlement is required before departure
      else if (
        balanceCents === 0 &&
        folio.status === FolioStatus.OPEN &&
        (stayReviewState === NightAuditStayReviewState.DUE_OUT ||
          stayReviewState === NightAuditStayReviewState.OVERDUE)
      ) {
        items.push({
          reservationId: reservation.id,
          confirmationNumber: reservation.reservationCode,
          reservationCode: reservation.reservationCode,
          guestId: reservation.guestId ?? reservation.guest?.id ?? null,
          guestName,
          departureDate: reservation.departureDate,
          roomId: reservation.roomId ?? null,
          roomNumber: reservation.room?.roomNumber ?? null,
          folioId: folio.id,
          folioStatus: folio.status,
          stayReviewState,
          totalCharges: totals.total,
          totalPayments: totals.paid,
          totalRefunds,
          balanceDue: totals.balance,
          exceptionType: NightAuditFolioExceptionType.UNSETTLED_ZERO_BALANCE,
          blocking: true,
          actions: this.resolveActions(
            NightAuditFolioExceptionType.UNSETTLED_ZERO_BALANCE,
            folio.status,
            balanceCents,
          ),
        });
      }
      // Properly settled or expected stayover with 0 balance -> no exception generated
    }

    // Deterministic sorting:
    // 1. Blocking items first
    // 2. Stay review priority: OVERDUE (1) -> DUE_OUT (2) -> STAYOVER (3)
    // 3. departureDate ASC
    // 4. roomNumber ASC
    // 5. reservationId ASC
    items.sort((a, b) => {
      if (a.blocking !== b.blocking) {
        return a.blocking ? -1 : 1;
      }
      const priorityDiff =
        REVIEW_STATE_PRIORITY[a.stayReviewState] - REVIEW_STATE_PRIORITY[b.stayReviewState];
      if (priorityDiff !== 0) return priorityDiff;

      const dateDiff = (a.departureDate ?? '').localeCompare(b.departureDate ?? '');
      if (dateDiff !== 0) return dateDiff;

      const roomA = a.roomNumber ?? '';
      const roomB = b.roomNumber ?? '';
      const roomDiff = roomA.localeCompare(roomB, undefined, { numeric: true });
      if (roomDiff !== 0) return roomDiff;

      return a.reservationId.localeCompare(b.reservationId);
    });

    let outstandingBalance = 0;
    let unsettledZeroBalance = 0;
    let missingFolio = 0;
    let blockingCount = 0;

    for (const item of items) {
      if (item.blocking) blockingCount++;
      if (item.exceptionType === NightAuditFolioExceptionType.OUTSTANDING_BALANCE) {
        outstandingBalance++;
      } else if (item.exceptionType === NightAuditFolioExceptionType.UNSETTLED_ZERO_BALANCE) {
        unsettledZeroBalance++;
      } else if (item.exceptionType === NightAuditFolioExceptionType.MISSING_FOLIO) {
        missingFolio++;
      }
    }

    return {
      count: items.length,
      blockingCount,
      summary: {
        outstandingBalance,
        unsettledZeroBalance,
        missingFolio,
      },
      items,
    };
  }

  /**
   * Returns valid action metadata for the exception:
   * - OPEN_FOLIO: when folio exists
   * - RECORD_PAYMENT: when folio is OPEN and balance > 0
   * - SETTLE_FOLIO: strictly when folio is OPEN and balance == 0 (matches BillingService.settleFolio rules)
   * - OPEN_STAY: always available
   */
  private resolveActions(
    type: NightAuditFolioExceptionType,
    folioStatus: FolioStatus,
    balanceCents: number,
  ): NightAuditActionDto[] {
    const actions: NightAuditActionDto[] = [{ type: 'OPEN_FOLIO' }];

    if (folioStatus === FolioStatus.OPEN && balanceCents > 0) {
      actions.push({ type: 'RECORD_PAYMENT' });
    }

    if (folioStatus === FolioStatus.OPEN && balanceCents === 0) {
      actions.push({ type: 'SETTLE_FOLIO' });
    }

    actions.push({ type: 'OPEN_STAY' });

    return actions;
  }
}
