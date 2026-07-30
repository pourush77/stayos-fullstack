import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { RoomTypeStatus } from '../domain/room-type-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'DLX', maxLength: 32 })
  @Transform(upperTrim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  @Matches(/^[A-Z0-9-]+$/)
  code!: string;

  @ApiProperty({ example: 'Deluxe Room', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({ example: 'Deluxe king room' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  baseOccupancy!: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  maxOccupancy!: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  maxAdults!: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: 20 })
  @IsInt()
  @Min(0)
  @Max(20)
  maxChildren!: number;

  @ApiPropertyOptional({ example: 'King', maxLength: 80 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  bedType?: string;

  @ApiPropertyOptional({ example: 320, minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  sizeSqFt?: number;

  @ApiPropertyOptional({ enum: RoomTypeStatus, default: RoomTypeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RoomTypeStatus)
  status?: RoomTypeStatus;
}
