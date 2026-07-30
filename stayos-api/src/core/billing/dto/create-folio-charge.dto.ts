import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsISO8601, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { FolioChargeType } from '../domain/folio-charge-type.enum';

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

  @ApiProperty({ example: '0.00', required: false })
  @IsOptional()
  @IsNumberString()
  taxAmount?: string;

  @ApiProperty({ required: false, description: 'ISO8601 timestamp; defaults to now' })
  @IsOptional()
  @IsISO8601()
  chargedAt?: string;
}
