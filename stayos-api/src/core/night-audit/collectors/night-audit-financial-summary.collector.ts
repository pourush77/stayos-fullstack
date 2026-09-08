import { Injectable } from '@nestjs/common';
import { Between, EntityManager, IsNull } from 'typeorm';
import { calculateTotals } from '../../billing/billing.mapper';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioPaymentType } from '../../billing/domain/folio-payment-type.enum';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { fromCents, toCents } from '../../billing/domain/money';
import { FolioChargeEntity } from '../../billing/infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from '../../billing/infrastructure/folio-payment.entity';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { NightAuditWorkspaceDto } from '../dto/night-audit-workspace.dto';
import type { NightAuditCompletionSnapshotFinancialSummary } from '../snapshots/night-audit-completion-snapshot';

const money = (cents: number): number => Number(fromCents(cents));

/**
 * Builds the immutable NA-V2.4 financial closing summary for a business date.
 *
 * All queries run on the CLOSE transaction's EntityManager so the summary
 * reflects the final state AFTER nightly accommodation posting within the same
 * atomic close. Charge/payment scoping mirrors RevenueReportService authoritative
 * business-date semantics: prefer `businessDate`; fall back to wall-clock
 * `chargedAt` / `receivedAt` ONLY for legacy rows with a NULL businessDate.
 * No financial rows are mutated. Group accommodation revenue is never fabricated
 * as ROOM revenue (only group master-folio payments are counted).
 */
@Injectable()
export class NightAuditFinancialSummaryCollector {
  async collect(
    manager: EntityManager,
    propertyId: string,
    businessDate: string,
    workspace: NightAuditWorkspaceDto,
    currency: string | null,
  ): Promise<NightAuditCompletionSnapshotFinancialSummary> {
    const dayStart = new Date(`${businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${businessDate}T23:59:59.999Z`);

    const chargeRepo = manager.getRepository(FolioChargeEntity);
    const paymentRepo = manager.getRepository(FolioPaymentEntity);
    const folioRepo = manager.getRepository(FolioEntity);
    const roomRepo = manager.getRepository(RoomEntity);
    const reservationRepo = manager.getRepository(ReservationEntity);

    const [charges, payments, openFolios, totalRooms, arrivals, departures, noShows] =
      await Promise.all([
        chargeRepo.find({
          where: [
            { folio: { propertyId }, businessDate: Between(dayStart, dayEnd) },
            { folio: { propertyId }, businessDate: IsNull(), chargedAt: Between(dayStart, dayEnd) },
          ],
          relations: { folio: true },
        }),
        paymentRepo.find({
          where: [
            { folio: { propertyId }, businessDate: Between(dayStart, dayEnd) },
            { folio: { propertyId }, businessDate: IsNull(), receivedAt: Between(dayStart, dayEnd) },
            { groupMasterFolio: { propertyId }, businessDate: Between(dayStart, dayEnd) },
            {
              groupMasterFolio: { propertyId },
              businessDate: IsNull(),
              receivedAt: Between(dayStart, dayEnd),
            },
          ],
          relations: { folio: true, groupMasterFolio: true },
        }),
        folioRepo.find({
          where: { propertyId, status: FolioStatus.OPEN },
          relations: { charges: true, payments: true },
        }),
        roomRepo.count({ where: { propertyId } }),
        reservationRepo.count({
          where: [
            { propertyId, arrivalDate: businessDate, status: ReservationStatus.CHECKED_IN },
            { propertyId, arrivalDate: businessDate, status: ReservationStatus.CHECKED_OUT },
          ],
        }),
        reservationRepo.count({
          where: { propertyId, departureDate: businessDate, status: ReservationStatus.CHECKED_OUT },
        }),
        reservationRepo.count({
          where: { propertyId, arrivalDate: businessDate, status: ReservationStatus.NO_SHOW },
        }),
      ]);

    // --- Charges (net over all rows; a REVERSAL row carries negated amount/tax) ---
    let roomCents = 0;
    let otherCents = 0;
    let taxCents = 0;
    for (const charge of charges) {
      const amount = toCents(charge.amount);
      taxCents += toCents(charge.taxAmount);
      if (charge.type === FolioChargeType.ROOM) {
        roomCents += amount;
      } else if (charge.type === FolioChargeType.TAX) {
        taxCents += amount;
      } else {
        otherCents += amount;
      }
    }
    const grossCents = roomCents + otherCents + taxCents;

    // --- Payments (refunds stored as negative REFUND rows) ---
    let paymentsCents = 0;
    let refundsCents = 0;
    let groupPaymentsCents = 0;
    let groupRefundsCents = 0;
    const byMethod = new Map<string, number>();
    for (const payment of payments) {
      const amount = toCents(payment.amount);
      if (payment.type === FolioPaymentType.REFUND) {
        refundsCents += Math.abs(amount);
        if (payment.groupMasterFolioId) groupRefundsCents += Math.abs(amount);
      } else {
        paymentsCents += amount;
        if (payment.groupMasterFolioId) groupPaymentsCents += amount;
      }
      byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + amount);
    }

    // --- Outstanding balance across OPEN folios (post nightly posting) ---
    let outstandingCents = 0;
    for (const folio of openFolios) {
      outstandingCents += toCents(
        calculateTotals(folio.charges ?? [], folio.payments ?? []).balance,
      );
    }

    const inHouseGroups = workspace.groupReview.items.filter(
      (item) => item.groupBookingStatus === 'CHECKED_IN',
    ).length;

    return {
      financialSummary: {
        currency,
        roomRevenue: money(roomCents),
        otherChargeRevenue: money(otherCents),
        grossCharges: money(grossCents),
        taxAmount: money(taxCents),
        paymentsCollected: money(paymentsCents),
        refunds: money(refundsCents),
        netCollections: money(paymentsCents - refundsCents),
        outstandingBalance: money(outstandingCents),
      },
      paymentBreakdown: [...byMethod.entries()].map(([method, cents]) => ({
        method,
        amount: money(cents),
      })),
      operationalSummary: {
        totalRooms,
        inHouseRooms: workspace.stayReview.count,
        stayovers: workspace.stayReview.summary.stayover,
        arrivals,
        departures,
        noShows,
      },
      groupSummary: {
        inHouseGroups,
        stayoverGroups: workspace.groupReview.summary.stayover,
        masterFolioPaymentsCollected: money(groupPaymentsCents),
        masterFolioRefunds: money(groupRefundsCents),
        accommodationRevenueIncluded: false,
      },
    };
  }
}
