import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsISO8601, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { FolioChargeType } from '../domain/folio-charge-type.enum';
import { PlaceOfSupply } from '../../rates/domain/gst.types';

export class CreateFolioChargeDto {
  @ApiProperty({ enum: FolioChargeType })
  @IsEnum(FolioChargeType)
  type!: FolioChargeType;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  description!: string;

  @ApiProperty({ example: 1, default: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Amount per unit (positive; use DISCOUNT type for reductions)', example: '3500.00' })
  @IsNumberString()
  unitAmount!: string;

  @ApiProperty({ example: '0.00', required: false, description: 'Explicit tax override; omit to auto-compute GST via configured tax rules' })
  @IsOptional()
  @IsNumberString()
  taxAmount?: string;

  @ApiProperty({ required: false, maxLength: 16, description: 'HSN/SAC code override for this line' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnSac?: string;

  @ApiProperty({ required: false, enum: PlaceOfSupply, description: 'Override place of supply (defaults to guest-vs-property state)' })
  @IsOptional()
  @IsEnum(PlaceOfSupply)
  placeOfSupply?: PlaceOfSupply;

  @ApiProperty({ required: false, description: 'ISO8601 timestamp; defaults to now' })
  @IsOptional()
  @IsISO8601()
  chargedAt?: string;
}
