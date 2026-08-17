import { buildInvoiceSnapshot, negateInvoiceSnapshot, InvoiceSnapshotError } from './invoice-snapshot';
import { FolioChargeStatus } from './domain/folio-charge-status.enum';
import { FolioChargeType } from './domain/folio-charge-type.enum';
import { FolioPaymentType } from './domain/folio-payment-type.enum';
import { PlaceOfSupply } from '../rates/domain/gst.types';

const property = {
  name: 'Grand Palace', legalName: 'Grand Palace Pvt Ltd', gstNumber: '29ABCDE1234F1Z5',
  addressLine1: '1 MG Road', addressLine2: null, city: 'Bengaluru', state: 'Karnataka',
  stateCode: '29', country: 'India', postalCode: '560001', email: 'a@b.com', phone: '080',
};
const guest = { displayName: 'John Doe', email: 'j@d.com', phone: '9', addressLine1: 'X', city: 'BLR', state: 'Karnataka', country: 'India', postalCode: '560001' };
const reservation = { reservationCode: 'RSV1', arrivalDate: '2029-01-01', departureDate: '2029-01-03', roomId: 'room1' };

function roomCharge(over = {}) {
  return {
    id: 'c1', type: FolioChargeType.ROOM, status: FolioChargeStatus.POSTED,
    description: 'Room 2 nights', hsnSac: '996311', quantity: 2,
    unitAmount: '5000.00', amount: '10000.00', taxAmount: '1200.00',
    chargedAt: new Date('2029-01-01T10:00:00Z'),
    taxSnapshot: {
      hsnSac: '996311', taxableValue: '10000.00', placeOfSupply: PlaceOfSupply.INTRA_STATE,
      totalRate: '12.00', totalTax: '1200.00',
      components: [
        { name: 'CGST', rate: '6.00', amount: '600.00' },
        { name: 'SGST', rate: '6.00', amount: '600.00' },
      ],
      taxRuleId: 'r1', ruleEffectiveFrom: '2026-01-01',
    },
    ...over,
  };
}

function folio(charges: any[], payments: any[] = [], over = {}) {
  return {
    id: 'f1', propertyId: 'p1', reservationId: 'res1', guestId: 'g1',
    folioNumber: 'FO-1', currency: 'INR', settledAt: new Date('2029-01-03T11:00:00Z'),
    property, guest, reservation, charges, payments, ...over,
  } as never;
}

describe('buildInvoiceSnapshot', () => {
  it('builds lines and totals from the frozen ledger (no recalculation), preserving HSN/SAC + GST split', () => {
    const snap = buildInvoiceSnapshot(folio([roomCharge()], [
      { id: 'p1', type: FolioPaymentType.PAYMENT, method: 'CASH', amount: '11200.00', reference: null, receivedAt: new Date('2029-01-03T10:00:00Z') },
    ]));
    expect(snap.lines).toHaveLength(1);
    const l = snap.lines[0];
    expect([l.hsnSac, l.taxableValue, l.taxRate, l.cgst.amount, l.sgst.amount, l.igst.amount, l.lineTotal])
      .toEqual(['996311', '10000.00', '12.00', '600.00', '600.00', '0.00', '11200.00']);
    expect([snap.totals.subtotal, snap.totals.taxTotal, snap.totals.cgstTotal, snap.totals.sgstTotal, snap.totals.grandTotal, snap.totals.balance])
      .toEqual(['10000.00', '1200.00', '600.00', '600.00', '11200.00', '0.00']);
    expect(snap.seller.gstin).toBe('29ABCDE1234F1Z5');
    expect(snap.seller.stateCode).toBe('29');
  });

  it('excludes reversed + reversal rows; active POSTED lines reproduce the ledger grand total exactly', () => {
    const reversed = roomCharge({ id: 'orig', status: FolioChargeStatus.REVERSED });
    const reversal = roomCharge({
      id: 'rev', status: FolioChargeStatus.REVERSAL, amount: '-10000.00', taxAmount: '-1200.00',
      taxSnapshot: { ...roomCharge().taxSnapshot, taxableValue: '-10000.00', totalTax: '-1200.00',
        components: [{ name: 'CGST', rate: '6.00', amount: '-600.00' }, { name: 'SGST', rate: '6.00', amount: '-600.00' }] },
    });
    const reposted = roomCharge({ id: 'new', amount: '15000.00', taxAmount: '1800.00', quantity: 3,
      taxSnapshot: { ...roomCharge().taxSnapshot, taxableValue: '15000.00', totalTax: '1800.00',
        components: [{ name: 'CGST', rate: '6.00', amount: '900.00' }, { name: 'SGST', rate: '6.00', amount: '900.00' }] },
      chargedAt: new Date('2029-01-02T10:00:00Z') });
    const snap = buildInvoiceSnapshot(folio([reversed, reversal, reposted], [
      { id: 'p', type: FolioPaymentType.PAYMENT, method: 'CASH', amount: '16800.00', reference: null, receivedAt: new Date() },
    ]));
    expect(snap.lines.map((l) => l.chargeId)).toEqual(['new']);
    expect(snap.totals.grandTotal).toBe('16800.00');
    expect(snap.totals.balance).toBe('0.00');
  });

  it('throws when there is no property (invalid state)', () => {
    expect(() => buildInvoiceSnapshot(folio([roomCharge()], [], { property: null }))).toThrow(InvoiceSnapshotError);
  });

  it('negateInvoiceSnapshot flips line + total signs for a full-reversal credit note', () => {
    const snap = buildInvoiceSnapshot(folio([roomCharge()], [
      { id: 'p1', type: FolioPaymentType.PAYMENT, method: 'CASH', amount: '11200.00', reference: null, receivedAt: new Date() },
    ]));
    const cn = negateInvoiceSnapshot(snap);
    expect(cn.totals.grandTotal).toBe('-11200.00');
    expect(cn.totals.cgstTotal).toBe('-600.00');
    expect(cn.lines[0].lineTotal).toBe('-11200.00');
    expect(cn.lines[0].cgst.amount).toBe('-600.00');
  });
});
