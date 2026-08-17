import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class LifecycleActionDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Optional reason for cancellation/no-show.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CheckInActionDto {
  @ApiPropertyOptional({ description: 'Explicitly approve an early check-in and apply the EARLY_CHECK_IN policy charge' })
  @IsOptional()
  @IsBoolean()
  earlyCheckIn?: boolean;
}

export class CheckOutActionDto {
  @ApiPropertyOptional({ description: 'Explicitly approve a late checkout and apply the LATE_CHECKOUT policy charge' })
  @IsOptional()
  @IsBoolean()
  lateCheckout?: boolean;
}
