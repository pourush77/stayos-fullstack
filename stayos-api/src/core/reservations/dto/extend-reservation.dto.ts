import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ExtendReservationDto {
  @ApiProperty({ example: '2026-07-20' })
  @IsDateString()
  departureDate!: string;
}
