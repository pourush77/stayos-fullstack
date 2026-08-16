/**
 * Foundation-only invoice number formatter. Pure and side-effect free: it does
 * NOT allocate/persist sequences (that belongs to the billing/night-audit
 * phase). It only defines how a prefix + sequence + optional financial-year
 * label render into a human-readable invoice number.
 */
export function buildInvoiceNumber(
  prefix: string,
  sequence: number,
  options: { financialYearLabel?: string; padLength?: number } = {},
): string {
  const padLength = options.padLength ?? 5;
  const seq = String(Math.max(Math.trunc(sequence), 1)).padStart(padLength, '0');
  const fy = options.financialYearLabel ? `${options.financialYearLabel}/` : '';
  return `${prefix}${fy}${seq}`;
}

/**
 * Derives an Indian-style financial year label (e.g. "2026-27") for a given
 * business date and configured FY start month. Reused later for yearly resets.
 */
export function financialYearLabel(businessDate: string, financialYearStartMonth: number): string {
  const [yearRaw, monthRaw] = businessDate.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const startYear = month >= financialYearStartMonth ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
}
