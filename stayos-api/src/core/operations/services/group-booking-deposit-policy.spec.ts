import { BadRequestException } from '@nestjs/common';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import { calculateGroupBookingDeposit } from './group-booking-deposit-policy';

describe('calculateGroupBookingDeposit', () => {
  it('returns zero for no deposit policy', () => {
    expect(
      calculateGroupBookingDeposit({ type: GroupBookingDepositPolicyType.NONE }, 3920),
    ).toEqual({
      basis: 'ESTIMATED_GRAND_TOTAL',
      policyType: GroupBookingDepositPolicyType.NONE,
      policyValue: 0,
      required: false,
      suggestedAmount: 0,
    });
  });

  it('calculates percentage against the estimated grand total', () => {
    expect(
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.PERCENTAGE, value: 20 },
        3920,
      ).suggestedAmount,
    ).toBe(784);
  });

  it('supports percentage totals across multi-room multi-night quotes', () => {
    expect(
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.PERCENTAGE, value: 10 },
        23520,
      ).suggestedAmount,
    ).toBe(2352);
  });

  it('returns a fixed amount policy', () => {
    expect(
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.FIXED_AMOUNT, value: 5000 },
        20000,
      ).suggestedAmount,
    ).toBe(5000);
  });

  it('clamps fixed deposits to the booking total', () => {
    expect(
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.FIXED_AMOUNT, value: 5000 },
        3920,
      ).suggestedAmount,
    ).toBe(3920);
  });

  it('rejects percentages above 100', () => {
    expect(() =>
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.PERCENTAGE, value: 101 },
        3920,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects non-positive percentages', () => {
    expect(() =>
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.PERCENTAGE, value: 0 },
        3920,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects non-positive fixed deposit values', () => {
    expect(() =>
      calculateGroupBookingDeposit(
        { type: GroupBookingDepositPolicyType.FIXED_AMOUNT, value: 0 },
        3920,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects explicit values for NONE policy', () => {
    expect(() =>
      calculateGroupBookingDeposit({ type: GroupBookingDepositPolicyType.NONE, value: 1 }, 3920),
    ).toThrow(BadRequestException);
  });

  it('accepts a persisted zero value for NONE policy', () => {
    expect(
      calculateGroupBookingDeposit({ type: GroupBookingDepositPolicyType.NONE, value: 0 }, 3920),
    ).toEqual({
      basis: 'ESTIMATED_GRAND_TOTAL',
      policyType: GroupBookingDepositPolicyType.NONE,
      policyValue: 0,
      required: false,
      suggestedAmount: 0,
    });
  });

  it('accepts a null value for NONE policy', () => {
    expect(
      calculateGroupBookingDeposit({ type: GroupBookingDepositPolicyType.NONE, value: null }, 3920)
        .suggestedAmount,
    ).toBe(0);
  });
});
