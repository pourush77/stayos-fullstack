import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Max } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';
import { GroupBookingDepositPolicyType } from '../domain/group-booking-deposit-policy-type.enum';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({
    enum: GroupBookingDepositPolicyType,
    example: GroupBookingDepositPolicyType.FIXED_AMOUNT,
    description:
      'Group booking deposit policy type. Omit groupBookingDepositPolicyValue when set to NONE.',
  })
  @IsOptional()
  @IsEnum(GroupBookingDepositPolicyType)
  groupBookingDepositPolicyType?: GroupBookingDepositPolicyType;

  @ApiPropertyOptional({
    type: Number,
    example: 5000,
    description:
      'Deposit value: percentage (0-100] for PERCENTAGE, positive amount for FIXED_AMOUNT, omitted for NONE.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === '' ? undefined : Number(value),
  )
  @IsOptional()
  @IsNumber()
  @Max(9999999999)
  groupBookingDepositPolicyValue?: number;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Enable or disable automatic guest email notifications for this property.',
  })
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;
}
