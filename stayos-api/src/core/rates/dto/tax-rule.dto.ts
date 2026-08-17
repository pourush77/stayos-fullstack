import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';

export class CreateTaxRuleDto {
  @ApiProperty({ maxLength: 120, example: 'Room accommodation (<= 7500/night)' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: FolioChargeType, description: 'Charge type this rule applies to' })
  @IsEnum(FolioChargeType)
  chargeType!: FolioChargeType;

  @ApiPropertyOptional({ maxLength: 16, example: '996311' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnSac?: string;

  @ApiProperty({ example: '12.00', description: 'Combined GST rate percentage (0-100)' })
  @IsNumberString()
  taxPercentage!: string;

  @ApiPropertyOptional({ example: '0.00', description: 'Inclusive lower bound of the per-unit tariff slab' })
  @IsOptional()
  @IsNumberString()
  slabMinAmount?: string;

  @ApiPropertyOptional({ example: '7500.00', description: 'Inclusive upper bound of the per-unit tariff slab (omit for unbounded)' })
  @IsOptional()
  @IsNumberString()
  slabMaxAmount?: string;

  @ApiProperty({ example: '2026-04-01', description: 'Rule active from this date (YYYY-MM-DD)' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaxRuleDto extends PartialType(CreateTaxRuleDto) {}
