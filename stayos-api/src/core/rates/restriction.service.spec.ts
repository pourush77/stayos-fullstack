import { HttpException } from '@nestjs/common';
import { RestrictionService, RestrictionViolationType } from './restriction.service';
import { RateRestrictionEntity } from './infrastructure/rate-restriction.entity';

const propertyId = 'prop-1';
const roomTypeId = 'rt-1';
const ratePlanId = 'rp-1';

function row(p: Partial<RateRestrictionEntity>): RateRestrictionEntity {
  return {
    id: Math.random().toString(36).slice(2),
    propertyId, roomTypeId, ratePlanId: null, date: '2026-07-10',
    stopSell: null, cta: null, ctd: null, minStay: null, maxStay: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...p,
  } as RateRestrictionEntity;
}

function build(rows: RateRestrictionEntity[]) {
  const restrictionsRepository = { find: jest.fn().mockResolvedValue(rows) };
  const ratePlansRepository = { findOne: jest.fn() };
  const service = new RestrictionService(restrictionsRepository as never, ratePlansRepository as never);
  return { service };
}

// arrival 07-10, departure 07-13 => occupied nights [10,11,12], los=3, departure date=13
const stay = { propertyId, roomTypeId, ratePlanId, arrivalDate: '2026-07-10', departureDate: '2026-07-13' };

describe('RestrictionService.evaluateStay', () => {
  it('is sellable with no restrictions', async () => {
    const { service } = build([]);
    await expect(service.evaluateStay(stay)).resolves.toEqual({ sellable: true, violations: [] });
  });

  it('blocks when an occupied night is stop-sold', async () => {
    const { service } = build([row({ date: '2026-07-11', stopSell: true })]);
    const r = await service.evaluateStay(stay);
    expect(r.sellable).toBe(false);
    expect(r.violations).toEqual([
      expect.objectContaining({ type: RestrictionViolationType.STOP_SELL, date: '2026-07-11' }),
    ]);
  });

  it('applies CTA only on the arrival date', async () => {
    const onArrival = await build([row({ date: '2026-07-10', cta: true })]).service.evaluateStay(stay);
    expect(onArrival.violations).toEqual([expect.objectContaining({ type: RestrictionViolationType.CTA, date: '2026-07-10' })]);
    // CTA on a non-arrival occupied night is ignored
    const midNight = await build([row({ date: '2026-07-11', cta: true })]).service.evaluateStay(stay);
    expect(midNight.sellable).toBe(true);
  });

  it('applies CTD only on the departure date (not on occupied nights)', async () => {
    const onDeparture = await build([row({ date: '2026-07-13', ctd: true })]).service.evaluateStay(stay);
    expect(onDeparture.violations).toEqual([expect.objectContaining({ type: RestrictionViolationType.CTD, date: '2026-07-13' })]);
    const lastNight = await build([row({ date: '2026-07-12', ctd: true })]).service.evaluateStay(stay);
    expect(lastNight.sellable).toBe(true);
  });

  it('enforces arrival-anchored minStay and maxStay against LOS', async () => {
    const minR = await build([row({ date: '2026-07-10', minStay: 5 })]).service.evaluateStay(stay);
    expect(minR.violations).toEqual([expect.objectContaining({ type: RestrictionViolationType.MIN_STAY, requiredMinStay: 5, date: '2026-07-10' })]);
    const maxR = await build([row({ date: '2026-07-10', maxStay: 2 })]).service.evaluateStay(stay);
    expect(maxR.violations).toEqual([expect.objectContaining({ type: RestrictionViolationType.MAX_STAY, allowedMaxStay: 2, date: '2026-07-10' })]);
    // LOS exactly at the bounds is allowed
    const okR = await build([row({ date: '2026-07-10', minStay: 3, maxStay: 3 })]).service.evaluateStay(stay);
    expect(okR.sellable).toBe(true);
  });

  it('precedence: rate-plan explicit false reopens a baseline stopSell (specificity override)', async () => {
    const { service } = build([
      row({ date: '2026-07-11', ratePlanId: null, stopSell: true }),
      row({ date: '2026-07-11', ratePlanId, stopSell: false }),
    ]);
    await expect(service.evaluateStay(stay)).resolves.toMatchObject({ sellable: true });
  });

  it('precedence: rate-plan NULL field inherits the baseline restriction', async () => {
    const { service } = build([
      row({ date: '2026-07-11', ratePlanId: null, stopSell: true }),
      row({ date: '2026-07-11', ratePlanId, stopSell: null, minStay: 2 }),
    ]);
    const r = await service.evaluateStay(stay);
    expect(r.sellable).toBe(false);
    expect(r.violations).toEqual([expect.objectContaining({ type: RestrictionViolationType.STOP_SELL, date: '2026-07-11' })]);
  });

  it('reports ALL applicable violations at once', async () => {
    const { service } = build([
      row({ date: '2026-07-10', cta: true, minStay: 5 }),
      row({ date: '2026-07-13', ctd: true }),
    ]);
    const r = await service.evaluateStay(stay);
    const types = r.violations.map((v) => v.type).sort();
    expect(types).toEqual([RestrictionViolationType.CTA, RestrictionViolationType.CTD, RestrictionViolationType.MIN_STAY].sort());
  });

  it('assertStaySellable throws 422 with structured violations', async () => {
    const { service } = build([row({ date: '2026-07-10', cta: true })]);
    await expect(service.assertStaySellable(stay)).rejects.toBeInstanceOf(HttpException);
    try {
      await service.assertStaySellable(stay);
    } catch (e) {
      const resp = (e as HttpException).getResponse() as { code: string; violations: unknown[] };
      expect((e as HttpException).getStatus()).toBe(422);
      expect(resp.code).toBe('RESTRICTION_VIOLATION');
      expect(resp.violations).toHaveLength(1);
    }
  });
});
