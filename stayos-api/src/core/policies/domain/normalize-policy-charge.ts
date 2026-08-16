import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { PolicyChargeMode } from './policy-charge-mode.enum';

export type PolicyChargeInput = {
  mode: PolicyChargeMode;
  value?: number | null;
};

export type NormalizedPolicyCharge = {
  mode: PolicyChargeMode;
  value: number;
};

/**
 * Normalizes a cancellation / no-show / early-check-in / late-checkout charge.
 * Kept separate from the deposit normalizer so deposit and charge concepts
 * never collapse into a single generic amount.
 */
export function normalizePolicyCharge(
  input: PolicyChargeInput,
  options: { allowFirstNight: boolean },
): NormalizedPolicyCharge {
  const rawValue = input.value;
  const hasValue = rawValue !== undefined && rawValue !== null;

  if (input.mode === PolicyChargeMode.NONE) {
    if (hasValue && Number(rawValue) > 0) {
      throw invalid('Charge value must be omitted or zero for a NONE charge.');
    }
    return { mode: PolicyChargeMode.NONE, value: 0 };
  }

  if (input.mode === PolicyChargeMode.FIRST_NIGHT) {
    if (!options.allowFirstNight) {
      throw invalid('FIRST_NIGHT is not a valid charge mode for this policy.');
    }
    if (hasValue && Number(rawValue) > 0) {
      throw invalid('Charge value must be omitted for a FIRST_NIGHT charge.');
    }
    return { mode: PolicyChargeMode.FIRST_NIGHT, value: 0 };
  }

  if (!hasValue) {
    throw invalid('Charge value is required for the selected charge mode.');
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw invalid('Charge value must be greater than 0.');
  }

  if (input.mode === PolicyChargeMode.PERCENTAGE && value > 100) {
    throw invalid('Charge percentage must be greater than 0 and at most 100.');
  }

  return { mode: input.mode, value };
}

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: ApiErrorCode.VALIDATION_ERROR, message });
}
