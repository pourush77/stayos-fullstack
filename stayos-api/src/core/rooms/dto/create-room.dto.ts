import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { RoomOperationalStatus } from '../domain/room-operational-status.enum';
import { RoomStatus } from '../domain/room-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  floorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomTypeId!: string;

  @ApiProperty({ example: '101', maxLength: 32 })
  @Transform(upperTrim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  @Matches(/^[A-Z0-9-]+$/)
  roomNumber!: string;

  @ApiPropertyOptional({ example: 'Room 101', maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Near elevator' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({
    enum: RoomOperationalStatus,
    default: RoomOperationalStatus.READY,
  })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  operationalStatus?: RoomOperationalStatus;
}
