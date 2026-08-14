import type { GuestPricingPolicyResponse } from '../../rates/api/rates-api';

export type ChildPricingPreview = {
  childSubtotal: number;
};

export function calculateChildPricingPreview(input: {
  childAges: number[];
  nights: number;
  nightlyRoomRate: number;
  policyResponse: GuestPricingPolicyResponse | null;
}): ChildPricingPreview {
  const { childAges, nights, nightlyRoomRate, policyResponse } = input;
  const policy = policyResponse?.policy;

  if (nights <= 0 || !policy?.ageBasedChildPricingEnabled || !policy.isActive) {
    return { childSubtotal: 0 };
  }

  const childSubtotal = childAges.reduce((sum, age) => {
    if (!Number.isInteger(age) || age < 0) return sum;

    if (age > policy.maximumChildAge) return sum;

    const band = policyResponse?.childAgeBands.find(
      (item) => item.isActive && age >= item.minAge && age <= item.maxAge,
    );

    if (!band) return sum;

    if (band.pricingMode === 'FIXED_PER_NIGHT') {
      return sum + Number(band.fixedAmount ?? 0) * nights;
    }

    if (band.pricingMode === 'PERCENT_OF_ROOM_RATE') {
      return sum + nightlyRoomRate * nights * (Number(band.percentage ?? 0) / 100);
    }

    return sum;
  }, 0);

  return { childSubtotal };
}

export function calculateBookingPricingPreview(input: {
  childAges: number[];
  nights: number;
  nightlyRoomRate: number;
  policyResponse: GuestPricingPolicyResponse | null;
  taxEnabled: boolean;
  taxPercentage: number;
}) {
  const roomSubtotal = input.nightlyRoomRate * input.nights;
  const { childSubtotal } = calculateChildPricingPreview(input);
  const subtotal = roomSubtotal + childSubtotal;
  const taxAmount = input.taxEnabled ? Math.round(subtotal * (input.taxPercentage / 100)) : 0;

  return {
    childSubtotal,
    roomSubtotal,
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}
