import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class ApproveLateCheckoutDto {
  @ApiProperty({
    example: '14:00',
    description: 'Approved checkout time in 24-hour format (HH:mm or HH:mm:ss)',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'approvedUntil must be a valid time in HH:mm or HH:mm:ss format',
  })
  approvedUntil!: string;

  @ApiPropertyOptional({
    description: 'Optional staff note or reason for late checkout approval',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Optional flag to apply the property late-checkout policy fee immediately',
  })
  @IsOptional()
  @IsBoolean()
  applyLateCheckoutFee?: boolean;
}
