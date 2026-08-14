import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { ChildAgeBandDto } from './child-age-band.dto';

export class UpsertGuestPricingPolicyDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ageBasedChildPricingEnabled?: boolean;

  @ApiProperty({ example: 17, minimum: 0 })
  @IsInt()
  @Min(0)
  maximumChildAge!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    type: () => [ChildAgeBandDto],
    example: [
      {
        label: 'Young Child',
        minAge: 0,
        maxAge: 5,
        pricingMode: 'FREE',
      },
      {
        label: 'Child',
        minAge: 6,
        maxAge: 11,
        pricingMode: 'FIXED_PER_NIGHT',
        fixedAmount: '800.00',
      },
      {
        label: 'Older Child',
        minAge: 12,
        maxAge: 17,
        pricingMode: 'ADULT_PRICING',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildAgeBandDto)
  childAgeBands!: ChildAgeBandDto[];
}
