import { FolioEntity } from './infrastructure/folio.entity';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { FolioPaymentStatus } from './domain/folio-payment-status.enum';
import { toCents, fromCents } from './domain/money';
import {
  FolioChargeResponseDto,
  FolioPaymentResponseDto,
  FolioResponseDto,
  FolioTotalsDto,
} from './dto/folio-response.dto';

export function calculateTotals(
  charges: FolioChargeEntity[] = [],
  payments: FolioPaymentEntity[] = [],
): FolioTotalsDto {
  // Cents-safe: sum every charge row (a REVERSAL row carries negated
  // amount/tax, so an original + its reversal net to zero — no filtering, full
  // audit trail preserved).
  let subtotalCents = 0;
  let taxCents = 0;
  let cgstCents = 0;
  let sgstCents = 0;
  let igstCents = 0;
  for (const charge of charges) {
    subtotalCents += toCents(charge.amount);
    taxCents += toCents(charge.taxAmount);
    // GST breakdown is aggregated from the frozen per-line tax snapshot (only
    // GST-engine charges carry one; explicit/manual tax is excluded here but
    // still counted in the scalar `tax`).
    for (const comp of charge.taxSnapshot?.components ?? []) {
      const c = toCents(comp.amount);
      if (comp.name === 'CGST') cgstCents += c;
      else if (comp.name === 'SGST') sgstCents += c;
      else if (comp.name === 'IGST') igstCents += c;
    }
  }
  const totalCents = subtotalCents + taxCents;
  // Cents-safe net captured: PAYMENT rows are positive, REFUND rows negative.
  const paidCents = payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const balanceCents = totalCents - paidCents;
  let paymentStatus: FolioPaymentStatus;
  if (balanceCents < 0) paymentStatus = FolioPaymentStatus.OVERPAID;
  else if (balanceCents === 0) paymentStatus = FolioPaymentStatus.PAID;
  else paymentStatus = paidCents > 0 ? FolioPaymentStatus.PARTIAL : FolioPaymentStatus.DUE;
  return {
    subtotal: fromCents(subtotalCents),
    tax: fromCents(taxCents),
    total: fromCents(totalCents),
    paid: fromCents(paidCents),
    balance: fromCents(balanceCents),
    creditBalance: fromCents(balanceCents < 0 ? -balanceCents : 0),
    paymentStatus,
    taxBreakdown: {
      cgst: fromCents(cgstCents),
      sgst: fromCents(sgstCents),
      igst: fromCents(igstCents),
    },
  };
}

function toChargeDto(charge: FolioChargeEntity): FolioChargeResponseDto {
  return {
    id: charge.id,
    folioId: charge.folioId,
    type: charge.type,
    status: charge.status,
    reversalOfChargeId: charge.reversalOfChargeId ?? null,
    rateSnapshotId: charge.rateSnapshotId ?? null,
    rateSnapshotVersion: charge.rateSnapshotVersion ?? null,
    description: charge.description,
    quantity: charge.quantity,
    unitAmount: charge.unitAmount,
    amount: charge.amount,
    taxAmount: charge.taxAmount,
    hsnSac: charge.hsnSac ?? null,
    taxSnapshot: charge.taxSnapshot ?? null,
    chargedAt: charge.chargedAt,
    createdByUserId: charge.createdByUserId,
    createdAt: charge.createdAt,
  };
}

function toPaymentDto(payment: FolioPaymentEntity): FolioPaymentResponseDto {
  return {
    id: payment.id,
    folioId: payment.folioId,
    method: payment.method,
    type: payment.type,
    reversalOfPaymentId: payment.reversalOfPaymentId ?? null,
    amount: payment.amount,
    reference: payment.reference,
    notes: payment.notes,
    idempotencyKey: payment.idempotencyKey ?? null,
    receivedAt: payment.receivedAt,
    receivedByUserId: payment.receivedByUserId,
    createdAt: payment.createdAt,
  };
}

export class BillingMapper {
  static toResponse(entity: FolioEntity): FolioResponseDto {
    const charges = entity.charges ?? [];
    const payments = entity.payments ?? [];
    const totals = calculateTotals(charges, payments);
    const guest = entity.guest;
    const reservation = entity.reservation;
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      reservationId: entity.reservationId,
      guestId: entity.guestId,
      folioNumber: entity.folioNumber,
      status: entity.status,
      currency: entity.currency,
      settledAt: entity.settledAt,
      notes: entity.notes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      totals,
      guest: {
        id: guest?.id ?? entity.guestId,
        displayName: guest?.displayName ?? '',
        email: guest?.email ?? null,
        phone: guest?.phone ?? null,
        isVip: Boolean(guest?.vipStatus),
      },
      reservation: {
        id: reservation?.id ?? entity.reservationId,
        reservationCode: reservation?.reservationCode ?? '',
        arrivalDate: reservation?.arrivalDate ?? '',
        departureDate: reservation?.departureDate ?? '',
        status: reservation?.status ?? '',
        paymentStatus: reservation?.paymentStatus ?? '',
        roomId: reservation?.roomId ?? null,
      },
      charges: charges
        .slice()
        .sort((a, b) => new Date(a.chargedAt).getTime() - new Date(b.chargedAt).getTime())
        .map(toChargeDto),
      payments: payments
        .slice()
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
        .map(toPaymentDto),
    };
  }
}
