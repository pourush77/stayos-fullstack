import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import {
  DepositPolicyInput,
  NormalizedDepositPolicy,
  normalizeDepositPolicy,
} from '../../policies/domain/normalize-deposit-policy';

export type GroupBookingDepositPolicy = NormalizedDepositPolicy;
export type GroupBookingDepositPolicyInput = DepositPolicyInput;

export type GroupBookingDepositQuote = {
  required: boolean;
  policyType: GroupBookingDepositPolicyType;
  policyValue: number;
  suggestedAmount: number;
  basis: 'ESTIMATED_GRAND_TOTAL';
};

/**
 * @deprecated Use normalizeDepositPolicy (policies/domain). Retained as a thin,
 * generic delegate so existing deposit calculation call sites keep working.
 */
export function normalizeGroupBookingDepositPolicy(
  policy: GroupBookingDepositPolicyInput,
): GroupBookingDepositPolicy {
  return normalizeDepositPolicy(policy);
}

export function calculateGroupBookingDeposit(
  policy: GroupBookingDepositPolicyInput,
  bookingGrandTotal: number,
): GroupBookingDepositQuote {
  const normalizedPolicy = normalizeDepositPolicy(policy);

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
