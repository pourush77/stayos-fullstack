import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';
import { GroupBookingDepositPolicyType } from '../domain/group-booking-deposit-policy-type.enum';

@ValidatorConstraint({ name: 'GroupBookingDepositPolicyPatchRule', async: false })
class GroupBookingDepositPolicyPatchRule implements ValidatorConstraintInterface {
  validate(_: unknown, validationArguments: ValidationArguments): boolean {
    const dto = validationArguments.object as UpdatePropertyDto;
    const policyType = dto.groupBookingDepositPolicyType;
    const policyValue = dto.groupBookingDepositPolicyValue;
    const hasType = policyType !== undefined;
    const hasValue = policyValue !== undefined;

    if (!hasType && !hasValue) {
      return true;
    }

    if (!hasType && hasValue) {
      return false;
    }

    if (policyType === GroupBookingDepositPolicyType.NONE) {
      return !hasValue;
    }

    if (!hasValue) {
      return false;
    }

    if (policyType === GroupBookingDepositPolicyType.PERCENTAGE) {
      return policyValue > 0 && policyValue <= 100;
    }

    if (policyType === GroupBookingDepositPolicyType.FIXED_AMOUNT) {
      return policyValue > 0;
    }

    return false;
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    const dto = validationArguments.object as UpdatePropertyDto;

    if (
      dto.groupBookingDepositPolicyType === undefined &&
      dto.groupBookingDepositPolicyValue !== undefined
    ) {
      return 'groupBookingDepositPolicyType is required when groupBookingDepositPolicyValue is provided';
    }

    if (dto.groupBookingDepositPolicyType === GroupBookingDepositPolicyType.NONE) {
      return 'groupBookingDepositPolicyValue must be omitted when groupBookingDepositPolicyType is NONE';
    }

    if (dto.groupBookingDepositPolicyType === GroupBookingDepositPolicyType.PERCENTAGE) {
      return 'groupBookingDepositPolicyValue must be greater than 0 and at most 100 for PERCENTAGE policy';
    }

    if (dto.groupBookingDepositPolicyType === GroupBookingDepositPolicyType.FIXED_AMOUNT) {
      return 'groupBookingDepositPolicyValue must be greater than 0 for FIXED_AMOUNT policy';
    }

    return 'Invalid group booking deposit policy configuration';
  }
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @IsOptional()
  @IsEnum(GroupBookingDepositPolicyType)
  groupBookingDepositPolicyType?: GroupBookingDepositPolicyType;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === '' ? undefined : Number(value),
  )
  @IsOptional()
  @IsNumber()
  @Max(9999999999)
  groupBookingDepositPolicyValue?: number;

  @Validate(GroupBookingDepositPolicyPatchRule)
  private readonly groupBookingDepositPolicyRule?: never;
}
