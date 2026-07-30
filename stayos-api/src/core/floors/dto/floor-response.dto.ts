import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FloorStatus } from '../domain/floor-status.enum';

export class FloorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  floorNumber!: number;

  @ApiProperty()
  displayOrder!: number;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: FloorStatus })
  status!: FloorStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
