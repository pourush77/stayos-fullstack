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
import { FloorStatus } from '../domain/floor-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateFloorDto {
  @ApiProperty({ example: 'FLOOR-01', maxLength: 32 })
  @Transform(upperTrim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  @Matches(/^[A-Z0-9-]+$/)
  code!: string;

  @ApiProperty({ example: 'First Floor', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: 1, minimum: -10, maximum: 300 })
  @IsInt()
  @Min(-10)
  @Max(300)
  floorNumber!: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 1000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  displayOrder?: number;

  @ApiPropertyOptional({ example: 'Guest rooms near elevator' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @ApiPropertyOptional({ enum: FloorStatus, default: FloorStatus.ACTIVE })
  @IsOptional()
  @IsEnum(FloorStatus)
  status?: FloorStatus;
}
