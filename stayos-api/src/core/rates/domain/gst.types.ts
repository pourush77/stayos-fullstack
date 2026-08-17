/**
 * Indian GST (Phase 1D-c) value types. Place of supply for hotel accommodation
 * is legally the hotel's location, so ROOM is always INTRA_STATE (CGST + SGST).
 * Other line types may be INTER_STATE (IGST) when the counterparty is registered
 * in a different state. All monetary values are cents-safe fixed 2-decimal
 * strings; the frozen `TaxSnapshot` is stored on each folio charge for audit.
 */
export enum PlaceOfSupply {
  INTRA_STATE = 'INTRA_STATE',
  INTER_STATE = 'INTER_STATE',
}

export type GstComponentName = 'CGST' | 'SGST' | 'IGST';

export interface GstComponent {
  name: GstComponentName;
  rate: string; // percentage, e.g. "6.00"
  amount: string; // cents-safe money string
}

export interface TaxSnapshot {
  hsnSac: string | null;
  taxableValue: string;
  placeOfSupply: PlaceOfSupply;
  totalRate: string; // combined GST rate, e.g. "12.00"
  totalTax: string; // sum of component amounts
  components: GstComponent[];
  taxRuleId: string | null;
  ruleEffectiveFrom: string | null; // YYYY-MM-DD
}

export interface GstComputation extends TaxSnapshot {
  applied: boolean; // false => no matching rule / zero taxable => no GST
  totalTaxCents: number;
}
