import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { GroupBookingDepositPolicyType } from '../../properties/domain/group-booking-deposit-policy-type.enum';
import { PolicyChargeMode } from '../domain/policy-charge-mode.enum';

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

/**
 * Single upsert payload for any property policy. The policy type comes from the
 * URL; the service applies strict, per-type semantic validation and rejects
 * fields that do not apply to the given policy type.
 */
export class UpsertPropertyPolicyDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Rate plan scope (foundation for future overrides).' })
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;

  @ApiPropertyOptional({ enum: GroupBookingDepositPolicyType, description: 'Required for deposit policies.' })
  @IsOptional()
  @IsEnum(GroupBookingDepositPolicyType)
  depositMode?: GroupBookingDepositPolicyType;

  @ApiPropertyOptional({ type: Number, example: 5000 })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999)
  depositValue?: number;

  @ApiPropertyOptional({ enum: PolicyChargeMode, description: 'Required for cancellation/no-show/early-checkin/late-checkout policies.' })
  @IsOptional()
  @IsEnum(PolicyChargeMode)
  chargeMode?: PolicyChargeMode;

  @ApiPropertyOptional({ type: Number, example: 20 })
  @Transform(toNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999)
  chargeValue?: number;

  @ApiPropertyOptional({ type: Number, example: 24, description: 'Free-cancellation window in hours before arrival.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8760)
  cancellationCutoffHours?: number;

  @ApiPropertyOptional({ type: Number, example: 60, description: 'Grace minutes before early-checkin/late-checkout fee applies.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  graceMinutes?: number;
}
