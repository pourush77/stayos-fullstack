import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyStatus } from '../domain/property-status.enum';

export class PropertyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  legalName!: string;

  @ApiProperty()
  gstNumber!: string;

  @ApiPropertyOptional()
  panNumber!: string | null;

  @ApiPropertyOptional()
  cinNumber!: string | null;

  @ApiPropertyOptional()
  logoUrl!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional()
  website!: string | null;

  @ApiProperty()
  addressLine1!: string;

  @ApiPropertyOptional()
  addressLine2!: string | null;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  checkInTime!: string;

  @ApiProperty()
  checkOutTime!: string;

  @ApiProperty()
  totalFloors!: number;

  @ApiProperty()
  totalRooms!: number;

  @ApiProperty({ enum: PropertyStatus })
  status!: PropertyStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
