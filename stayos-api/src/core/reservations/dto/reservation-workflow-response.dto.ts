import { ApiProperty } from '@nestjs/swagger';
import { RoomResponseDto } from '../../rooms/dto/room-response.dto';
import { ReservationResponseDto } from './reservation-response.dto';

export class ReservationWorkflowResponseDto {
  @ApiProperty({ type: ReservationResponseDto })
  reservation!: ReservationResponseDto;

  @ApiProperty({ type: RoomResponseDto })
  room!: RoomResponseDto;
}
