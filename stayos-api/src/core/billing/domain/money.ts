/**
 * Cents-safe money helpers for the billing ledger. All arithmetic is performed
 * on integer cents to avoid binary float drift; values are stored/returned as
 * fixed 2-decimal strings (numeric(12,2) in the DB).
 */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromCents(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}
