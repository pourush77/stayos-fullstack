import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class EarlyDepartureDto {
  @ApiProperty({ example: '2026-09-10', description: 'Effective (new) departure date before the booked departure' })
  @IsDateString()
  newDepartureDate!: string;

  @ApiPropertyOptional({ example: 'Guest leaving early for a flight' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
