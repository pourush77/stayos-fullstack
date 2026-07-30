import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';

export class ReservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ format: 'uuid' })
  guestId!: string;

  @ApiProperty()
  reservationCode!: string;

  @ApiProperty({ type: String, format: 'date' })
  arrivalDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  departureDate!: string;

  @ApiProperty()
  adults!: number;

  @ApiProperty()
  children!: number;

  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  roomId!: string | null;

  @ApiProperty({ enum: ReservationSource })
  source!: ReservationSource;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  @ApiProperty({ enum: ReservationPaymentStatus })
  paymentStatus!: ReservationPaymentStatus;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiPropertyOptional()
  specialRequests!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
