import { BadRequestException } from '@nestjs/common';
import { PolicyChargeMode } from './policy-charge-mode.enum';
import { normalizePolicyCharge } from './normalize-policy-charge';

describe('normalizePolicyCharge', () => {
  it('normalizes NONE to a zero charge', () => {
    expect(normalizePolicyCharge({ mode: PolicyChargeMode.NONE }, { allowFirstNight: true })).toEqual({
      mode: PolicyChargeMode.NONE,
      value: 0,
    });
  });

  it('accepts FIRST_NIGHT when allowed', () => {
    expect(
      normalizePolicyCharge({ mode: PolicyChargeMode.FIRST_NIGHT }, { allowFirstNight: true }),
    ).toEqual({ mode: PolicyChargeMode.FIRST_NIGHT, value: 0 });
  });

  it('rejects FIRST_NIGHT when not allowed', () => {
    expect(() =>
      normalizePolicyCharge({ mode: PolicyChargeMode.FIRST_NIGHT }, { allowFirstNight: false }),
    ).toThrow(BadRequestException);
  });

  it('accepts a valid percentage', () => {
    expect(
      normalizePolicyCharge({ mode: PolicyChargeMode.PERCENTAGE, value: 20 }, { allowFirstNight: true }),
    ).toEqual({ mode: PolicyChargeMode.PERCENTAGE, value: 20 });
  });

  it('rejects a percentage above 100', () => {
    expect(() =>
      normalizePolicyCharge({ mode: PolicyChargeMode.PERCENTAGE, value: 150 }, { allowFirstNight: true }),
    ).toThrow(BadRequestException);
  });

  it('rejects a non-positive fixed amount', () => {
    expect(() =>
      normalizePolicyCharge({ mode: PolicyChargeMode.FIXED_AMOUNT, value: 0 }, { allowFirstNight: false }),
    ).toThrow(BadRequestException);
  });

  it('requires a value for percentage/fixed modes', () => {
    expect(() =>
      normalizePolicyCharge({ mode: PolicyChargeMode.FIXED_AMOUNT }, { allowFirstNight: false }),
    ).toThrow(BadRequestException);
  });
});
