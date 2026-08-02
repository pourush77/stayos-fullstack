import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuestStatus } from '../domain/guest-status.enum';

export class GuestReservationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date' })
  arrivalDate!: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  departureDate!: string | null;

  @ApiPropertyOptional()
  reservationCode!: string | null;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  paymentStatus!: string | null;

  @ApiPropertyOptional()
  roomNumber!: string | null;

  @ApiPropertyOptional()
  roomType!: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  folioId!: string | null;

  @ApiPropertyOptional()
  folioNumber!: string | null;

  @ApiPropertyOptional()
  folioStatus!: string | null;
}

export class GuestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiPropertyOptional()
  lastName!: string | null;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional()
  alternatePhone!: string | null;

  @ApiPropertyOptional()
  email!: string | null;

  @ApiPropertyOptional()
  gender!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  dateOfBirth!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date' })
  anniversaryDate!: string | null;

  @ApiPropertyOptional()
  nationality!: string | null;

  @ApiPropertyOptional()
  preferredLanguage!: string | null;

  @ApiPropertyOptional()
  roomPreference!: string | null;

  @ApiPropertyOptional()
  bedPreference!: string | null;

  @ApiPropertyOptional()
  smokingPreference!: string | null;

  @ApiPropertyOptional()
  floorPreference!: string | null;

  @ApiPropertyOptional()
  dietaryNotes!: string | null;

  @ApiPropertyOptional()
  companyName!: string | null;

  @ApiPropertyOptional()
  gstNumber!: string | null;

  @ApiProperty()
  vipStatus!: boolean;

  @ApiProperty()
  blacklistStatus!: boolean;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiProperty({ enum: GuestStatus })
  status!: GuestStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: [GuestReservationSummaryDto] })
  reservations!: GuestReservationSummaryDto[];
}
