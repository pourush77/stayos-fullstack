import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeProvider = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  guestId!: string;

  @ApiProperty({ example: '2026-07-15', format: 'date' })
  @IsDateString()
  arrivalDate!: string;

  @ApiProperty({ example: '2026-07-17', format: 'date' })
  @IsDateString()
  departureDate!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ type: [Number], example: [4, 9] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  childAges?: number[];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Rate plan; falls back to property default if omitted' })
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;

  @ApiPropertyOptional({ enum: ReservationSource, default: ReservationSource.FRONT_DESK })
  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;

  @ApiPropertyOptional({
    maxLength: 64,
    description:
      'Normalized channel/provider identifier (e.g. BOOKING_COM). REQUIRED when externalReservationId is supplied. Set-once (immutable after create).',
  })
  @ValidateIf((o) => o.externalReservationId !== undefined && o.externalReservationId !== null)
  @Transform(normalizeProvider)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @IsOptional()
  sourceProvider?: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'External OTA/channel reservation ID. Set-once (immutable after create); drives idempotent dedup.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 128)
  externalReservationId?: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'External confirmation number. Nullable now; write-once completion in 1C-d3.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 128)
  externalConfirmationId?: string;

  @ApiPropertyOptional({ enum: ReservationStatus, default: ReservationStatus.CONFIRMED })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({
    enum: ReservationPaymentStatus,
    default: ReservationPaymentStatus.PAYMENT_DUE,
  })
  @IsOptional()
  @IsEnum(ReservationPaymentStatus)
  paymentStatus?: ReservationPaymentStatus;

  @ApiPropertyOptional({ example: 'Guest requested airport transfer' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;

  @ApiPropertyOptional({ example: 'Twin bed setup and late arrival' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  specialRequests?: string;
}
