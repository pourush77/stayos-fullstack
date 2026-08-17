import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Read-only pricing quote input for the individual booking flow. Mirrors the
 * commercial fields of CreateReservationDto so the quote runs the SAME pricing
 * path a create would persist. No guest / no side effects.
 */
export class QuoteReservationDto {
  @ApiProperty({ example: '2026-08-18', format: 'date' })
  @IsDateString()
  arrivalDate!: string;

  @ApiProperty({ example: '2026-08-19', format: 'date' })
  @IsDateString()
  departureDate!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ type: [Number], example: [4, 9] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  childAges?: number[];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomTypeId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Rate plan; falls back to the property default (e.g. BAR) if omitted.',
  })
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;
}
