/**
 * Lifecycle of a folio charge line. Posted financial records are NEVER deleted
 * or mutated — a correction is a new REVERSAL row (negated amounts) that points
 * at the original, and the original is flipped to REVERSED. Totals remain a
 * pure sum over all rows (original +X, reversal -X => net 0), preserving the
 * full audit trail.
 */
export enum FolioChargeStatus {
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  REVERSAL = 'REVERSAL',
}
