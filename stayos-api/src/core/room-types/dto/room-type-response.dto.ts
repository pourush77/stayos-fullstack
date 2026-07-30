import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomTypeStatus } from '../domain/room-type-status.enum';

export class RoomTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  baseOccupancy!: number;

  @ApiProperty()
  maxOccupancy!: number;

  @ApiProperty()
  maxAdults!: number;

  @ApiProperty()
  maxChildren!: number;

  @ApiPropertyOptional()
  bedType!: string | null;

  @ApiPropertyOptional()
  sizeSqFt!: number | null;

  @ApiProperty({ enum: RoomTypeStatus })
  status!: RoomTypeStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
