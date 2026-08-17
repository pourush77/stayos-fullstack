/**
 * Ledger direction of a folio payment row. Payments are append-only: a refund
 * is a REFUND row (stored with a negative amount) linked to the original
 * PAYMENT via reversalOfPaymentId — never a destructive edit of the original.
 */
export enum FolioPaymentType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}
