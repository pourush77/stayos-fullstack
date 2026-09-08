import { ApiProperty } from '@nestjs/swagger';
import { ReservationResponseDto } from './reservation-response.dto';
import { RoomResponseDto } from '../../rooms/dto/room-response.dto';

export class EarlyDepartureResponseDto {
  @ApiProperty({ type: () => ReservationResponseDto })
  reservation!: ReservationResponseDto;

  @ApiProperty({ type: () => RoomResponseDto })
  room!: RoomResponseDto;

  @ApiProperty({ example: '2026-09-12', description: 'Original booked departure date' })
  originalDepartureDate!: string;

  @ApiProperty({ example: '2026-09-10', description: 'Effective (shortened) departure date' })
  effectiveDepartureDate!: string;

  @ApiProperty({ example: 2, description: 'Number of future unconsumed accommodation nights waived' })
  nightsWaived!: number;

  @ApiProperty({
    example: 'Future unconsumed nights waived. Already posted room charges are unchanged.',
    description: 'Financial consequence summary',
  })
  financialConsequence!: string;
}
