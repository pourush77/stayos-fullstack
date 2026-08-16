import { buildInvoiceNumber, financialYearLabel } from './invoice-number';

describe('invoice-number', () => {
  it('formats prefix + zero-padded sequence', () => {
    expect(buildInvoiceNumber('INV-', 7)).toBe('INV-00007');
  });

  it('includes a financial-year label when provided', () => {
    expect(buildInvoiceNumber('INV-', 42, { financialYearLabel: '2026-27' })).toBe('INV-2026-27/00042');
  });

  it('respects a custom pad length and clamps sequence to at least 1', () => {
    expect(buildInvoiceNumber('X', 0, { padLength: 3 })).toBe('X001');
  });

  it('derives an Indian financial year label (April start)', () => {
    expect(financialYearLabel('2026-06-15', 4)).toBe('2026-27');
    expect(financialYearLabel('2026-03-15', 4)).toBe('2025-26');
  });
});
