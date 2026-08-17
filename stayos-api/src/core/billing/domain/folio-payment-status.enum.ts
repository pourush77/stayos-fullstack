/** Derived, never-stored folio payment state (from charges + tax + payments). */
export enum FolioPaymentStatus {
  DUE = 'DUE',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERPAID = 'OVERPAID',
}
