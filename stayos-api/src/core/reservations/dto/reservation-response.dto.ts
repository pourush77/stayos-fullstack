import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';

export class BookedRatePlanResponseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  id?: string | null;

  @ApiPropertyOptional()
  code?: string | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  mealPlan?: string | null;

  @ApiPropertyOptional()
  refundable?: boolean | null;

  @ApiPropertyOptional()
  nightlyRate?: string | null;
}

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

  @ApiPropertyOptional({ type: [Number] })
  childAges?: number[] | null;

  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  roomId!: string | null;

  @ApiProperty({ enum: ReservationSource })
  source!: ReservationSource;

  @ApiPropertyOptional({ description: 'Normalized channel/provider identifier' })
  sourceProvider?: string | null;

  @ApiPropertyOptional({ description: 'External OTA/channel reservation ID' })
  externalReservationId?: string | null;

  @ApiPropertyOptional({ description: 'External confirmation number' })
  externalConfirmationId?: string | null;

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

  @ApiPropertyOptional()
  guestName?: string;

  @ApiPropertyOptional()
  guestPhone?: string;

  @ApiPropertyOptional()
  guestEmail?: string;

  @ApiPropertyOptional()
  roomTypeName?: string;

  @ApiPropertyOptional()
  roomNumber?: string;

  @ApiPropertyOptional({ type: BookedRatePlanResponseDto })
  bookedRatePlan?: BookedRatePlanResponseDto | null;

  @ApiPropertyOptional({ description: 'Approved late checkout time (HH:mm or HH:mm:ss)' })
  lateCheckoutApprovedUntil?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lateCheckoutApprovedAt?: Date | null;

  @ApiPropertyOptional()
  lateCheckoutApprovedBy?: string | null;

  @ApiPropertyOptional()
  lateCheckoutNotes?: string | null;
}
