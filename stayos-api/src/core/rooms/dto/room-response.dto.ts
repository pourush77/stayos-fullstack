import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomOperationalStatus } from '../domain/room-operational-status.enum';
import { RoomStatus } from '../domain/room-status.enum';

export class RoomResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ format: 'uuid' })
  floorId!: string;

  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiPropertyOptional()
  displayName!: string | null;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: RoomStatus })
  status!: RoomStatus;

  @ApiProperty({ enum: RoomOperationalStatus })
  operationalStatus!: RoomOperationalStatus;

  @ApiPropertyOptional()
  operationalStatusReason!: string | null;

  @ApiPropertyOptional()
  operationalStatusNote!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
