import { FolioEntity } from './infrastructure/folio.entity';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioChargeStatus } from './domain/folio-charge-status.enum';
import { calculateTotals } from './billing.mapper';
import { toCents, fromCents } from './domain/money';

/**
 * Immutable invoice snapshot types. Everything an invoice needs to be
 * reproduced forever is frozen here at finalization time, so later changes to
 * the folio, tax rules or property configuration never alter issued history.
 */
export interface InvoiceTaxComponent {
  rate: string;
  amount: string;
}

export interface InvoiceLineSnapshot {
  chargeId: string;
  type: string;
  description: string;
  hsnSac: string | null;
  quantity: number;
  unitAmount: string;
  taxableValue: string;
  taxRate: string;
  placeOfSupply: string | null;
  cgst: InvoiceTaxComponent;
  sgst: InvoiceTaxComponent;
  igst: InvoiceTaxComponent;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoiceTotalsSnapshot {
  subtotal: string;
  taxTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  grandTotal: string;
  paid: string;
  balance: string;
}

export interface InvoicePaymentSnapshot {
  id: string;
  type: string;
  method: string;
  amount: string;
  reference: string | null;
  receivedAt: string;
}

export interface InvoiceSellerSnapshot {
  name: string;
  legalName: string;
  gstin: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  country: string;
  postalCode: string;
  email: string;
  phone: string;
}

export interface InvoiceBuyerSnapshot {
  guestId: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  gstin: string | null;
}

export interface InvoiceReservationSnapshot {
  reservationId: string;
  reservationCode: string;
  arrivalDate: string;
  departureDate: string;
  roomId: string | null;
  folioId: string;
  folioNumber: string;
}

export interface InvoiceSnapshot {
  currency: string;
  placeOfSupply: string;
  seller: InvoiceSellerSnapshot;
  buyer: InvoiceBuyerSnapshot;
  reservation: InvoiceReservationSnapshot;
  lines: InvoiceLineSnapshot[];
  totals: InvoiceTotalsSnapshot;
  payments: InvoicePaymentSnapshot[];
  settledAt: string | null;
}

/** Thrown when the folio is not in a valid, priced financial state to invoice. */
export class InvoiceSnapshotError extends Error {}

const ZERO: InvoiceTaxComponent = { rate: '0.00', amount: '0.00' };

function componentFor(
  charge: FolioChargeEntity,
  name: 'CGST' | 'SGST' | 'IGST',
): InvoiceTaxComponent {
  const comp = charge.taxSnapshot?.components?.find((c) => c.name === name);
  return comp ? { rate: comp.rate, amount: comp.amount } : { ...ZERO };
}

/**
 * Builds the immutable invoice snapshot directly from the FROZEN folio ledger
 * (charge amounts + per-line GST snapshots + payments). It never recalculates
 * prices or taxes. Only currently-active (POSTED) charge lines are included;
 * reversed originals and their negating reversals net out of the ledger totals,
 * so the sum of invoice lines must equal the ledger grand total (asserted).
 */
export function buildInvoiceSnapshot(folio: FolioEntity): InvoiceSnapshot {
  const property = folio.property;
  const guest = folio.guest;
  const reservation = folio.reservation;
  if (!property) throw new InvoiceSnapshotError('Folio is missing property details');

  const allCharges = folio.charges ?? [];
  const payments = folio.payments ?? [];
  const activeCharges = allCharges
    .filter((c) => c.status === FolioChargeStatus.POSTED)
    .slice()
    .sort((a, b) => new Date(a.chargedAt).getTime() - new Date(b.chargedAt).getTime());

  const lines: InvoiceLineSnapshot[] = activeCharges.map((charge) => {
    const taxableCents = toCents(charge.amount);
    const taxCents = toCents(charge.taxAmount);
    return {
      chargeId: charge.id,
      type: charge.type,
      description: charge.description,
      hsnSac: charge.hsnSac ?? null,
      quantity: charge.quantity,
      unitAmount: charge.unitAmount,
      taxableValue: charge.amount,
      taxRate: charge.taxSnapshot?.totalRate ?? '0.00',
      placeOfSupply: charge.taxSnapshot?.placeOfSupply ?? null,
      cgst: componentFor(charge, 'CGST'),
      sgst: componentFor(charge, 'SGST'),
      igst: componentFor(charge, 'IGST'),
      taxAmount: charge.taxAmount,
      lineTotal: fromCents(taxableCents + taxCents),
    };
  });

  // Cents-safe totals come from the same ledger function used everywhere else.
  const totals = calculateTotals(allCharges, payments);
  const grandTotalCents = toCents(totals.total);

  // Invariant: the invoice lines must reproduce the ledger grand total exactly.
  const lineSumCents = lines.reduce((s, l) => s + toCents(l.lineTotal), 0);
  if (lineSumCents !== grandTotalCents) {
    throw new InvoiceSnapshotError(
      `Invoice line total (${fromCents(lineSumCents)}) does not match folio grand total (${totals.total})`,
    );
  }

  const placeOfSupply = lines.find((l) => l.placeOfSupply)?.placeOfSupply ?? 'INTRA_STATE';

  return {
    currency: folio.currency,
    placeOfSupply,
    seller: {
      name: property.name,
      legalName: property.legalName,
      gstin: property.gstNumber || null,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2 ?? null,
      city: property.city,
      state: property.state,
      stateCode: property.stateCode,
      country: property.country,
      postalCode: property.postalCode,
      email: property.email,
      phone: property.phone,
    },
    buyer: {
      guestId: folio.guestId,
      name: guest?.displayName ?? '',
      email: guest?.email ?? null,
      phone: guest?.phone ?? null,
      addressLine1: guest?.addressLine1 ?? null,
      city: guest?.city ?? null,
      state: guest?.state ?? null,
      country: guest?.country ?? null,
      postalCode: guest?.postalCode ?? null,
      gstin: null,
    },
    reservation: {
      reservationId: folio.reservationId,
      reservationCode: reservation?.reservationCode ?? '',
      arrivalDate: reservation?.arrivalDate ?? '',
      departureDate: reservation?.departureDate ?? '',
      roomId: reservation?.roomId ?? null,
      folioId: folio.id,
      folioNumber: folio.folioNumber,
    },
    lines,
    totals: {
      subtotal: totals.subtotal,
      taxTotal: totals.tax,
      cgstTotal: totals.taxBreakdown.cgst,
      sgstTotal: totals.taxBreakdown.sgst,
      igstTotal: totals.taxBreakdown.igst,
      grandTotal: totals.total,
      paid: totals.paid,
      balance: totals.balance,
    },
    payments: payments
      .slice()
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
      .map((p) => ({
        id: p.id,
        type: p.type,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
        receivedAt: new Date(p.receivedAt).toISOString(),
      })),
    settledAt: folio.settledAt ? new Date(folio.settledAt).toISOString() : null,
  };
}

/** Negates a snapshot's monetary values for a full-reversal credit note. */
export function negateInvoiceSnapshot(snap: InvoiceSnapshot): InvoiceSnapshot {
  const neg = (v: string): string => fromCents(-toCents(v));
  const negComp = (c: InvoiceTaxComponent): InvoiceTaxComponent => ({ rate: c.rate, amount: neg(c.amount) });
  return {
    ...snap,
    lines: snap.lines.map((l) => ({
      ...l,
      taxableValue: neg(l.taxableValue),
      cgst: negComp(l.cgst),
      sgst: negComp(l.sgst),
      igst: negComp(l.igst),
      taxAmount: neg(l.taxAmount),
      lineTotal: neg(l.lineTotal),
    })),
    totals: {
      subtotal: neg(snap.totals.subtotal),
      taxTotal: neg(snap.totals.taxTotal),
      cgstTotal: neg(snap.totals.cgstTotal),
      sgstTotal: neg(snap.totals.sgstTotal),
      igstTotal: neg(snap.totals.igstTotal),
      grandTotal: neg(snap.totals.grandTotal),
      paid: neg(snap.totals.paid),
      balance: neg(snap.totals.balance),
    },
    payments: [],
  };
}
