import assert from 'node:assert/strict';

const { calculateBookingPricingPreview } = await import('./child-pricing-preview.ts');

const policyResponse = {
  policy: {
    id: 'policy-1',
    propertyId: 'property-1',
    ageBasedChildPricingEnabled: true,
    maximumChildAge: 17,
    isActive: true,
  },
  childAgeBands: [
    {
      label: 'Free',
      minAge: 0,
      maxAge: 5,
      pricingMode: 'FREE',
      fixedAmount: null,
      percentage: null,
      displayOrder: 0,
      isActive: true,
    },
    {
      label: 'Fixed',
      minAge: 6,
      maxAge: 11,
      pricingMode: 'FIXED_PER_NIGHT',
      fixedAmount: '850.00',
      percentage: null,
      displayOrder: 1,
      isActive: true,
    },
    {
      label: 'Percent',
      minAge: 12,
      maxAge: 13,
      pricingMode: 'PERCENT_OF_ROOM_RATE',
      fixedAmount: null,
      percentage: '50.00',
      displayOrder: 2,
      isActive: true,
    },
    {
      label: 'Adult',
      minAge: 14,
      maxAge: 17,
      pricingMode: 'ADULT_PRICING',
      fixedAmount: null,
      percentage: null,
      displayOrder: 3,
      isActive: true,
    },
  ],
};

function preview(childAges, nights = 1, nightlyRoomRate = 6500) {
  return calculateBookingPricingPreview({
    childAges,
    nights,
    nightlyRoomRate,
    policyResponse,
    taxEnabled: true,
    taxPercentage: 12,
  });
}

assert.equal(preview([]).total, 7280, 'zero children preserves room-only total');
assert.equal(preview([4]).childSubtotal, 0, 'FREE child has no surcharge');
assert.equal(preview([9]).childSubtotal, 850, 'FIXED_PER_NIGHT child adds fixed amount');
assert.equal(preview([9], 3).childSubtotal, 2550, 'fixed child pricing scales by nights');
assert.equal(preview([12]).childSubtotal, 3250, 'PERCENT_OF_ROOM_RATE mirrors backend basis');
assert.equal(preview([4, 9]).total, 8232, 'multiple children produce expected booking total');
assert.equal(preview([14]).childSubtotal, 0, 'ADULT_PRICING remains zero until adult surcharge exists');
assert.equal(preview([18]).childSubtotal, 0, 'age above maximumChildAge uses adult-pricing limitation');
assert.equal(preview([9]).total, 8232, 'child age change updates total from room-only amount');

const disabled = calculateBookingPricingPreview({
  childAges: [9],
  nights: 1,
  nightlyRoomRate: 6500,
  policyResponse: {
    ...policyResponse,
    policy: { ...policyResponse.policy, ageBasedChildPricingEnabled: false },
  },
  taxEnabled: true,
  taxPercentage: 12,
});
assert.equal(disabled.total, 7280, 'disabled child pricing preserves existing behavior');

const taxDisabled = calculateBookingPricingPreview({
  childAges: [9],
  nights: 1,
  nightlyRoomRate: 3500,
  policyResponse,
  taxEnabled: false,
  taxPercentage: 12,
});
assert.equal(taxDisabled.total, 4350, 'disabled tax removes the tax row from the preview total');

const eighteenPercent = calculateBookingPricingPreview({
  childAges: [9],
  nights: 1,
  nightlyRoomRate: 3500,
  policyResponse,
  taxEnabled: true,
  taxPercentage: 18,
});
assert.equal(eighteenPercent.taxAmount, 783, 'configured 18% tax is applied to room plus child subtotal');

console.log('child-pricing-preview assertions passed');
