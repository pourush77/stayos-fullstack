import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';

export type GroupBookingDepositPolicy = {
  type: GroupBookingDepositPolicyType;
  value: number;
};

export type GroupBookingDepositPolicyInput = {
  type: GroupBookingDepositPolicyType;
  value?: number | null;
};

export type GroupBookingDepositQuote = {
  required: boolean;
  policyType: GroupBookingDepositPolicyType;
  policyValue: number;
  suggestedAmount: number;
  basis: 'ESTIMATED_GRAND_TOTAL';
};

export function normalizeGroupBookingDepositPolicy(
  policy: GroupBookingDepositPolicyInput,
): GroupBookingDepositPolicy {
  const rawValue = policy.value;

  if (policy.type === GroupBookingDepositPolicyType.NONE) {
    const noneValue = rawValue === undefined || rawValue === null ? 0 : Number(rawValue);

    if (!Number.isFinite(noneValue) || noneValue > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Group booking deposit value must be omitted or zero for NONE policy.',
      });
    }

    return {
      type: GroupBookingDepositPolicyType.NONE,
      value: 0,
    };
  }

  if (rawValue === undefined || rawValue === null) {
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Group booking deposit value is required for the selected policy.',
    });
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Group booking deposit value must be greater than 0.',
    });
  }

  if (policy.type === GroupBookingDepositPolicyType.PERCENTAGE && value > 100) {
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Group booking deposit percentage must be greater than 0 and at most 100.',
    });
  }

  return {
    type: policy.type,
    value,
  };
}

export function calculateGroupBookingDeposit(
  policy: GroupBookingDepositPolicyInput,
  bookingGrandTotal: number,
): GroupBookingDepositQuote {
  const normalizedPolicy = normalizeGroupBookingDepositPolicy(policy);

  const total = Math.max(Number(bookingGrandTotal) || 0, 0);
  let suggestedAmount = 0;

  if (normalizedPolicy.type === GroupBookingDepositPolicyType.PERCENTAGE) {
    suggestedAmount = Math.round((total * normalizedPolicy.value) / 100);
  }

  if (normalizedPolicy.type === GroupBookingDepositPolicyType.FIXED_AMOUNT) {
    suggestedAmount = Math.min(Math.round(normalizedPolicy.value), Math.round(total));
  }

  return {
    basis: 'ESTIMATED_GRAND_TOTAL',
    policyType: normalizedPolicy.type,
    policyValue:
      normalizedPolicy.type === GroupBookingDepositPolicyType.NONE ? 0 : normalizedPolicy.value,
    required: suggestedAmount > 0,
    suggestedAmount,
  };
}
