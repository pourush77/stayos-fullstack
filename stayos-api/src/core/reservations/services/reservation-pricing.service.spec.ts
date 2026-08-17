import { ReservationPricingService } from './reservation-pricing.service';

const propertyId = 'prop-1';
const roomTypeId = 'rt-1';
const base = { propertyId, roomTypeId, arrivalDate: '2026-07-15', departureDate: '2026-07-17', adults: 2 };

function build(overrides: { defaultPlan?: unknown; resolved?: unknown; resolveError?: Error } = {}) {
  const rateResolver = {
    resolve: overrides.resolveError
      ? jest.fn().mockRejectedValue(overrides.resolveError)
      : jest.fn().mockResolvedValue(
          overrides.resolved ?? {
            ratePlanId: 'rp-1',
            ratePlanCode: 'BAR',
            roomTypeId,
            mealPlan: 'BREAKFAST',
            refundable: true,
            occupancy: { adults: 2, children: 0, baseOccupancy: 2, extraAdults: 0 },
            nights: [{ date: '2026-07-15', source: 'BASE_RATE', roomRate: '5000.00', extraAdultCharge: '0.00', childCharge: '0.00', nightTotal: '5000.00' }],
            totals: { room: '10000.00', extraAdult: '0.00', child: '0.00', grandTotal: '10000.00' },
            policies: {},
            childPricing: { limitations: [] },
          },
        ),
  };
  const ratesService = {
    findDefaultApplicableRatePlan: jest
      .fn()
      .mockResolvedValue(overrides.defaultPlan === undefined ? null : overrides.defaultPlan),
  };
  const service = new ReservationPricingService(rateResolver as never, ratesService as never);
  return { service, rateResolver, ratesService };
}

describe('ReservationPricingService', () => {
  it('prices with an explicit rate plan (PRICED snapshot)', async () => {
    const { service, rateResolver } = build();
    const r = await service.buildCommercialSnapshot({ ...base, ratePlanId: 'rp-1' });
    expect(rateResolver.resolve).toHaveBeenCalledWith(expect.objectContaining({ ratePlanId: 'rp-1' }), undefined);
    expect(r.ratePlanId).toBe('rp-1');
    expect(r.rateSnapshot).toMatchObject({ pricingStatus: 'PRICED', ratePlan: { code: 'BAR' }, totals: { grandTotal: '10000.00' } });
  });

  it('falls back to the property default plan when ratePlanId omitted', async () => {
    const { service, rateResolver } = build({ defaultPlan: { id: 'rp-default' } });
    const r = await service.buildCommercialSnapshot({ ...base, ratePlanId: null });
    expect(rateResolver.resolve).toHaveBeenCalledWith(expect.objectContaining({ ratePlanId: 'rp-default' }), undefined);
    expect(r.ratePlanId).toBe('rp-default');
  });

  it('an explicit rate plan overrides the default (default lookup not used)', async () => {
    const { service, ratesService } = build({ defaultPlan: { id: 'rp-default' } });
    const r = await service.buildCommercialSnapshot({ ...base, ratePlanId: 'rp-explicit' });
    expect(ratesService.findDefaultApplicableRatePlan).not.toHaveBeenCalled();
    expect(r.ratePlanId).toBe('rp-explicit');
  });

  it('commits an explicit UNPRICED state (never 0) when no plan/default exists', async () => {
    const { service, rateResolver } = build({ defaultPlan: null });
    const r = await service.buildCommercialSnapshot({ ...base, ratePlanId: null });
    expect(rateResolver.resolve).not.toHaveBeenCalled();
    expect(r.ratePlanId).toBeNull();
    expect(r.rateSnapshot).toMatchObject({ pricingStatus: 'UNPRICED', reason: 'NO_APPLICABLE_RATE_PLAN' });
    expect(JSON.stringify(r.rateSnapshot)).not.toContain('0.00');
  });

  it('propagates a clean failure for an invalid/inapplicable explicit plan', async () => {
    const { service } = build({ resolveError: new Error('not applicable') });
    await expect(
      service.buildCommercialSnapshot({ ...base, ratePlanId: 'bad' }),
    ).rejects.toThrow('not applicable');
  });
});
