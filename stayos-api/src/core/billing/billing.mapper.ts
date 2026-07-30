import { FolioEntity } from './infrastructure/folio.entity';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import {
  FolioChargeResponseDto,
  FolioPaymentResponseDto,
  FolioResponseDto,
  FolioTotalsDto,
} from './dto/folio-response.dto';

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return value.toFixed(2);
}

export function calculateTotals(
  charges: FolioChargeEntity[] = [],
  payments: FolioPaymentEntity[] = [],
): FolioTotalsDto {
  let subtotal = 0;
  let tax = 0;
  for (const charge of charges) {
    subtotal += toNumber(charge.amount);
    tax += toNumber(charge.taxAmount);
  }
  const total = subtotal + tax;
  const paid = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const balance = total - paid;
  return {
    subtotal: money(subtotal),
    tax: money(tax),
    total: money(total),
    paid: money(paid),
    balance: money(balance),
  };
}

function toChargeDto(charge: FolioChargeEntity): FolioChargeResponseDto {
  return {
    id: charge.id,
    folioId: charge.folioId,
    type: charge.type,
    description: charge.description,
    quantity: charge.quantity,
    unitAmount: charge.unitAmount,
    amount: charge.amount,
    taxAmount: charge.taxAmount,
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
    amount: payment.amount,
    reference: payment.reference,
    notes: payment.notes,
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
