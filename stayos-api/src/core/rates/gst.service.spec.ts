import { GstService } from './gst.service';
import { PlaceOfSupply } from './domain/gst.types';
import { FolioChargeType } from '../billing/domain/folio-charge-type.enum';

type Rule = {
  id: string;
  chargeType: string;
  hsnSac: string | null;
  taxPercentage: string;
  slabMinAmount: string | null;
  slabMaxAmount: string | null;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: Date;
};

const rule = (o: Partial<Rule> = {}): Rule => ({
  id: o.id ?? 'r1',
  chargeType: o.chargeType ?? FolioChargeType.ROOM,
  hsnSac: o.hsnSac ?? '996311',
  taxPercentage: o.taxPercentage ?? '12.00',
  slabMinAmount: o.slabMinAmount ?? null,
  slabMaxAmount: o.slabMaxAmount ?? null,
  effectiveFrom: o.effectiveFrom ?? '2026-01-01',
  isActive: o.isActive ?? true,
  createdAt: o.createdAt ?? new Date('2026-01-01T00:00:00Z'),
});

describe('GstService.computeTax', () => {
  let repoRows: Rule[];
  let service: GstService;

  const buildRepo = () => ({ find: jest.fn(async () => repoRows) });

  const makeService = () => {
    const repo = buildRepo();
    return {
      service: new GstService(repo as never, { findOne: jest.fn().mockResolvedValue({}) } as never),
      repo,
    };
  };

  beforeEach(() => {
    repoRows = [];
    service = makeService().service;
  });

  it('splits odd rates so components sum to the exact configured-rate total (no paisa loss)', async () => {
    repoRows = [rule({ chargeType: FolioChargeType.FOOD_AND_BEVERAGE, taxPercentage: '5.00', hsnSac: '996331' })];
    const r = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.FOOD_AND_BEVERAGE, taxableAmountCents: 33333, // 333.33
      placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-01'),
    });
    // 5% of 333.33 = 16.6665 -> total 16.67; split 8.34 + 8.33
    expect(r.totalTax).toBe('16.67');
    const sum = r.components.reduce((s, c) => s + Math.round(parseFloat(c.amount) * 100), 0);
    expect(sum).toBe(1667);
  });

  it('returns zero (applied:false) when no rule matches — engine ships empty', async () => {
    const r = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 1000000,
      slabBasisAmount: 5000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-01'),
    });
    expect(r.applied).toBe(false);
    expect(r.totalTax).toBe('0.00');
    expect(r.components).toHaveLength(0);
  });

  it('splits INTRA_STATE into equal CGST + SGST summing to the total (cents-safe)', async () => {
    repoRows = [rule({ taxPercentage: '12.00' })];
    const r = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 1500000, // 15000.00
      slabBasisAmount: 5000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-01'),
    });
    expect(r.applied).toBe(true);
    expect(r.components.map((c) => [c.name, c.rate, c.amount])).toEqual([
      ['CGST', '6.00', '900.00'],
      ['SGST', '6.00', '900.00'],
    ]);
    expect(r.totalTax).toBe('1800.00');
    expect(r.hsnSac).toBe('996311');
  });

  it('produces a single IGST component for INTER_STATE', async () => {
    repoRows = [rule({ chargeType: FolioChargeType.SPA, taxPercentage: '18.00', hsnSac: '999799' })];
    const r = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.SPA, taxableAmountCents: 100000, // 1000.00
      placeOfSupply: PlaceOfSupply.INTER_STATE, chargeDate: new Date('2026-08-01'),
    });
    expect(r.components).toEqual([{ name: 'IGST', rate: '18.00', amount: '180.00' }]);
    expect(r.totalTax).toBe('180.00');
  });

  it('selects the slab whose range contains the per-unit basis', async () => {
    repoRows = [
      rule({ id: 'low', taxPercentage: '12.00', slabMinAmount: '0.00', slabMaxAmount: '7500.00' }),
      rule({ id: 'high', taxPercentage: '18.00', slabMinAmount: '7500.01', slabMaxAmount: null }),
    ];
    const low = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 500000,
      slabBasisAmount: 5000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-01'),
    });
    expect(low.taxRuleId).toBe('low');
    expect(low.totalRate).toBe('12.00');

    const high = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 900000,
      slabBasisAmount: 9000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-01'),
    });
    expect(high.taxRuleId).toBe('high');
    expect(high.totalRate).toBe('18.00');
  });

  it('honors effective-dating: picks the latest rule effective on/before the charge date, ignores future rules', async () => {
    repoRows = [
      rule({ id: 'old', taxPercentage: '12.00', effectiveFrom: '2026-01-01' }),
      rule({ id: 'new', taxPercentage: '5.00', effectiveFrom: '2026-09-01' }),
    ];
    const before = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 100000,
      slabBasisAmount: 5000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-15'),
    });
    expect(before.taxRuleId).toBe('old');

    const after = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 100000,
      slabBasisAmount: 5000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-09-15'),
    });
    expect(after.taxRuleId).toBe('new');
    expect(after.totalRate).toBe('5.00');
  });

  it('returns zero tax when the taxable amount is zero even if a rule matches', async () => {
    repoRows = [rule()];
    const r = await service.computeTax({
      propertyId: 'p', chargeType: FolioChargeType.ROOM, taxableAmountCents: 0,
      slabBasisAmount: 5000, placeOfSupply: PlaceOfSupply.INTRA_STATE, chargeDate: new Date('2026-08-01'),
    });
    expect(r.applied).toBe(false);
    expect(r.totalTax).toBe('0.00');
  });
});

describe('GstService.resolvePlaceOfSupply', () => {
  const service = new GstService({ find: jest.fn() } as never, { findOne: jest.fn() } as never);

  it('is INTRA_STATE when guest state is empty', () => {
    expect(service.resolvePlaceOfSupply('Karnataka', 'KA', null)).toBe(PlaceOfSupply.INTRA_STATE);
  });
  it('is INTRA_STATE when guest state matches property state (case-insensitive)', () => {
    expect(service.resolvePlaceOfSupply('Karnataka', 'KA', ' karnataka ')).toBe(PlaceOfSupply.INTRA_STATE);
  });
  it('is INTER_STATE when guest state differs from property state', () => {
    expect(service.resolvePlaceOfSupply('Karnataka', 'KA', 'Maharashtra')).toBe(PlaceOfSupply.INTER_STATE);
  });
});
