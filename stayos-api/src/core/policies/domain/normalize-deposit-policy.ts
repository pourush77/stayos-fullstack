import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';

export type DepositPolicyInput = {
  type: GroupBookingDepositPolicyType;
  value?: number | null;
};

export type NormalizedDepositPolicy = {
  type: GroupBookingDepositPolicyType;
  value: number;
};

/**
 * Generic, policy-aware deposit normalizer shared by every deposit policy
 * (individual, group, and any future scope). Messages are parameterised by an
 * optional label so they are not group-specific.
 *
 * Rules: NONE => value omitted/null/0 (normalized to 0); PERCENTAGE => 0<v<=100;
 * FIXED_AMOUNT => v>0.
 */
export function normalizeDepositPolicy(
  input: DepositPolicyInput,
  options: { label?: string } = {},
): NormalizedDepositPolicy {
  const label = options.label ?? 'Deposit';
  const rawValue = input.value;

  if (input.type === GroupBookingDepositPolicyType.NONE) {
    const noneValue = rawValue === undefined || rawValue === null ? 0 : Number(rawValue);
    if (!Number.isFinite(noneValue) || noneValue !== 0) {
      throw invalid(`${label} value must be omitted or zero for a NONE policy.`);
    }
    return { type: GroupBookingDepositPolicyType.NONE, value: 0 };
  }

  if (rawValue === undefined || rawValue === null) {
    throw invalid(`${label} value is required for the selected policy.`);
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw invalid(`${label} value must be greater than 0.`);
  }

  if (input.type === GroupBookingDepositPolicyType.PERCENTAGE && value > 100) {
    throw invalid(`${label} percentage must be greater than 0 and at most 100.`);
  }

  return { type: input.type, value };
}

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: ApiErrorCode.VALIDATION_ERROR, message });
}
