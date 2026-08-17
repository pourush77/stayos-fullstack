import { BadRequestException } from '@nestjs/common';
import { ChildPricingService } from './child-pricing.service';
import { ChildPricingMode } from './domain/child-pricing-mode.enum';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';

function band(input: Partial<ChildAgeBandEntity>): ChildAgeBandEntity {
  return {
    id: input.id ?? `${input.minAge}-${input.maxAge}`,
    guestPricingPolicyId: input.guestPricingPolicyId ?? 'policy-1',
    guestPricingPolicy: undefined as never,
    label: input.label ?? 'Band',
    minAge: input.minAge ?? 0,
    maxAge: input.maxAge ?? 5,
    pricingMode: input.pricingMode ?? ChildPricingMode.FREE,
    fixedAmount: input.fixedAmount ?? null,
    percentage: input.percentage ?? null,
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? true,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  };
}

describe('ChildPricingService', () => {
  const policyRepository = { findOne: jest.fn() };
  const bandRepository = { find: jest.fn() };
  let service: ChildPricingService;

  beforeEach(() => {
    jest.clearAllMocks();
    policyRepository.findOne.mockResolvedValue({
      id: 'policy-1',
      propertyId,
      ageBasedChildPricingEnabled: true,
      maximumChildAge: 17,
      isActive: true,
    } as GuestPricingPolicyEntity);
    bandRepository.find.mockResolvedValue([
      band({ label: 'Free', minAge: 0, maxAge: 5, pricingMode: ChildPricingMode.FREE }),
      band({
        label: 'Fixed',
        minAge: 6,
        maxAge: 11,
        pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
        fixedAmount: '850.00',
      }),
      band({
        label: 'Half',
        minAge: 12,
        maxAge: 13,
        pricingMode: ChildPricingMode.PERCENT_OF_ROOM_RATE,
        percentage: '50.00',
      }),
      band({
        label: 'Adult',
        minAge: 14,
        maxAge: 17,
        pricingMode: ChildPricingMode.ADULT_PRICING,
      }),
    ]);
    service = new ChildPricingService(policyRepository as never, bandRepository as never);
  });

  it('returns no charges for zero children', async () => {
    await expect(service.resolveChildPricing(propertyId, [], 2, 3500)).resolves.toEqual({
      lines: [],
      total: 0,
      limitations: [],
    });
  });

  it('calculates free, fixed, percent, adult, and above-maximum children', async () => {
    await expect(service.resolveChildPricing(propertyId, [4, 9, 12, 14, 18], 2, 4000)).resolves.toMatchObject({
      lines: [
        { age: 4, pricingMode: ChildPricingMode.FREE, amount: 0, isAdultPriced: false, source: 'BAND_FREE' },
        { age: 9, pricingMode: ChildPricingMode.FIXED_PER_NIGHT, amount: 1700, isAdultPriced: false, source: 'BAND_FIXED_PER_NIGHT' },
        { age: 12, pricingMode: ChildPricingMode.PERCENT_OF_ROOM_RATE, amount: 4000, isAdultPriced: false, source: 'BAND_PERCENT_OF_ROOM_RATE' },
        { age: 14, pricingMode: ChildPricingMode.ADULT_PRICING, amount: 0, isAdultPriced: true, source: 'ADULT_PRICING' },
        { age: 18, pricingMode: 'ABOVE_MAXIMUM_CHILD_AGE', amount: 0, isAdultPriced: true, source: 'ABOVE_MAXIMUM_CHILD_AGE' },
      ],
      total: 5700,
      limitations: [],
    });
  });

  it('prices a RATE_PLAN_EXTRA_CHILD band from the rate plan extra-child charge', async () => {
    bandRepository.find.mockResolvedValue([
      band({ label: 'RatePlanChild', minAge: 0, maxAge: 12, pricingMode: ChildPricingMode.RATE_PLAN_EXTRA_CHILD }),
    ]);
    const r = await service.resolveChildPricing(propertyId, [5], 2, 4000, 700);
    expect(r.lines[0]).toMatchObject({
      age: 5,
      pricingMode: ChildPricingMode.RATE_PLAN_EXTRA_CHILD,
      amount: 1400,
      isAdultPriced: false,
      source: 'RATE_PLAN_EXTRA_CHILD',
    });
    expect(r.total).toBe(1400);
  });

  it('rejects missing, negative, decimal, and mismatched child ages', async () => {
    await expect(service.validateReservationChildAges(propertyId, 1, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validateReservationChildAges(propertyId, 1, [-1])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validateReservationChildAges(propertyId, 1, [1.5])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validateReservationChildAges(propertyId, 2, [4])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('loads policy by the current property only', async () => {
    await service.resolveChildPricing(otherPropertyId, [4], 1, 3500);

    expect(policyRepository.findOne).toHaveBeenCalledWith({
      where: { propertyId: otherPropertyId, isActive: true },
    });
    expect(bandRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guestPricingPolicyId: 'policy-1', isActive: true } }),
    );
  });

  it('rejects ages inside maximumChildAge that do not resolve to exactly one band', async () => {
    bandRepository.find.mockResolvedValue([
      band({ minAge: 0, maxAge: 5 }),
      band({ minAge: 5, maxAge: 10 }),
    ]);

    await expect(service.resolveChildPricing(propertyId, [5], 1, 3500)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
