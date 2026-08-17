import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RateResolverService } from './rate-resolver.service';
import { RatePlanStatus } from './domain/rate-plan-status.enum';
import { MealPlan } from './domain/meal-plan.enum';

const propertyId = 'prop-1';
const ratePlanId = 'rp-1';
const roomTypeId = 'rt-1';

function build(overrides: {
  plan?: unknown;
  applicability?: unknown;
  dailyRates?: unknown[];
  childResult?: unknown;
  policy?: unknown;
} = {}) {
  const ratePlansRepository = {
    findOne: jest.fn().mockResolvedValue(
      overrides.plan === undefined
        ? { id: ratePlanId, propertyId, code: 'BAR', status: RatePlanStatus.ACTIVE, mealPlan: MealPlan.BREAKFAST, refundable: true }
        : overrides.plan,
    ),
  };
  const ratePlanRoomTypesRepository = {
    findOne: jest.fn().mockResolvedValue(
      overrides.applicability === undefined
        ? { propertyId, ratePlanId, roomTypeId, baseOccupancy: 2, baseRate: '5000.00', extraAdultCharge: '1500.00', extraChildCharge: '0.00' }
        : overrides.applicability,
    ),
  };
  const dailyRatesRepository = { find: jest.fn().mockResolvedValue(overrides.dailyRates ?? []) };
  const childPricingService = {
    resolveChildPricing: jest.fn().mockResolvedValue(overrides.childResult ?? { lines: [], total: 0, limitations: [] }),
  };
  const policyResolver = { resolve: jest.fn().mockResolvedValue(overrides.policy ?? null) };
  const service = new RateResolverService(
    ratePlansRepository as never,
    ratePlanRoomTypesRepository as never,
    dailyRatesRepository as never,
    policyResolver as never,
    childPricingService as never,
  );
  return { service, ratePlansRepository, ratePlanRoomTypesRepository, dailyRatesRepository, childPricingService, policyResolver };
}

const baseInput = { propertyId, ratePlanId, roomTypeId, arrivalDate: '2026-07-15', departureDate: '2026-07-17', adults: 2 };

describe('RateResolverService', () => {
  it('falls back to base rate when no override exists', async () => {
    const { service } = build();
    const r = await service.resolve(baseInput);
    expect(r.nights).toHaveLength(2);
    expect(r.nights.every((n) => n.source === 'BASE_RATE' && n.roomRate === '5000.00')).toBe(true);
    expect(r.totals.room).toBe('10000.00');
    expect(r.mealPlan).toBe(MealPlan.BREAKFAST);
    expect(r.refundable).toBe(true);
  });

  it('uses the daily override in precedence over base for that night only', async () => {
    const { service } = build({ dailyRates: [{ stayDate: '2026-07-15', amount: '6500.00' }] });
    const r = await service.resolve(baseInput);
    expect(r.nights[0]).toMatchObject({ date: '2026-07-15', source: 'DAILY_OVERRIDE', roomRate: '6500.00' });
    expect(r.nights[1]).toMatchObject({ date: '2026-07-16', source: 'BASE_RATE', roomRate: '5000.00' });
    expect(r.totals.room).toBe('11500.00');
  });

  it('scopes the override query to property + ratePlan + roomType (isolation across plans)', async () => {
    const { service, dailyRatesRepository } = build();
    await service.resolve(baseInput);
    expect(dailyRatesRepository.find).toHaveBeenCalledWith({ where: { propertyId, ratePlanId, roomTypeId } });
  });

  it('adds no extra-adult charge at base occupancy', async () => {
    const { service } = build();
    const r = await service.resolve({ ...baseInput, adults: 2 });
    expect(r.occupancy.extraAdults).toBe(0);
    expect(r.totals.extraAdult).toBe('0.00');
  });

  it('charges extra adults above base occupancy per night', async () => {
    const { service } = build();
    const r = await service.resolve({ ...baseInput, adults: 3 });
    expect(r.occupancy.extraAdults).toBe(1);
    expect(r.nights[0].extraAdultCharge).toBe('1500.00');
    expect(r.totals.extraAdult).toBe('3000.00'); // 2 nights
  });

  it('delegates child pricing to ChildPricingService and includes it in totals', async () => {
    const { service, childPricingService } = build({ childResult: { lines: [], total: 500, limitations: ['x'] } });
    const r = await service.resolve({ ...baseInput, childAges: [6] });
    expect(childPricingService.resolveChildPricing).toHaveBeenCalledWith(propertyId, [6], 1, 5000);
    expect(r.totals.child).toBe('1000.00'); // 500 * 2 nights
    expect(r.childPricing.limitations).toContain('x');
  });

  it('rejects an inactive rate plan', async () => {
    const { service } = build({ plan: { id: ratePlanId, propertyId, code: 'BAR', status: RatePlanStatus.INACTIVE } });
    await expect(service.resolve(baseInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound for a missing rate plan', async () => {
    const { service } = build({ plan: null });
    await expect(service.resolve(baseInput)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails explicitly when the room type is not applicable (no base/override) — never 0', async () => {
    const { service } = build({ applicability: null });
    await expect(service.resolve(baseInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves policies via PolicyResolver, marking RATE_PLAN vs PROPERTY source', async () => {
    const ratePlanPolicy = { ratePlanId, isActive: true };
    const { service } = build({ policy: ratePlanPolicy });
    const r = await service.resolve(baseInput);
    expect((r.policies['CANCELLATION'] as { source: string }).source).toBe('RATE_PLAN');
  });

  it('marks PROPERTY source when only a property-level policy exists', async () => {
    const { service } = build({ policy: { ratePlanId: null, isActive: true } });
    const r = await service.resolve(baseInput);
    expect((r.policies['NO_SHOW'] as { source: string }).source).toBe('PROPERTY');
  });

  it('handles multi-night mixed base/override pricing with a correct grand total', async () => {
    const { service } = build({ dailyRates: [{ stayDate: '2026-07-16', amount: '7000.00' }] });
    const r = await service.resolve({ ...baseInput, departureDate: '2026-07-18', adults: 3 });
    // nights: 15(base 5000), 16(override 7000), 17(base 5000); extra adult 1500/night x3
    expect(r.totals.room).toBe('17000.00');
    expect(r.totals.extraAdult).toBe('4500.00');
    expect(r.totals.grandTotal).toBe('21500.00');
  });

  it('keeps decimal precision (no float drift) on repeated cents math', async () => {
    const { service } = build({ applicability: { propertyId, ratePlanId, roomTypeId, baseOccupancy: 1, baseRate: '99.99', extraAdultCharge: '0.01' } });
    const r = await service.resolve({ ...baseInput, adults: 2, departureDate: '2026-07-18' }); // 3 nights, 1 extra adult
    expect(r.totals.room).toBe('299.97');
    expect(r.totals.extraAdult).toBe('0.03');
    expect(r.totals.grandTotal).toBe('300.00');
  });
});
