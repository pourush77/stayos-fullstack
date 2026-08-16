import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpsertPropertyBillingConfigDto {
  @ApiProperty({ example: 'INV-', maxLength: 16 })
  @Transform(trimUpper)
  @IsString()
  @MaxLength(16)
  @Matches(/^[A-Z0-9/\-]*$/)
  invoicePrefix!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  nextInvoiceNumber!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  resetSequenceYearly!: boolean;

  @ApiProperty({ example: 4, minimum: 1, maximum: 12, description: 'Financial year start month (India=4).' })
  @IsInt()
  @Min(1)
  @Max(12)
  financialYearStartMonth!: number;

  @ApiPropertyOptional({ example: '996311', maxLength: 16, description: 'Default HSN/SAC code for room revenue.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(16)
  defaultHsnSac?: string | null;
}
