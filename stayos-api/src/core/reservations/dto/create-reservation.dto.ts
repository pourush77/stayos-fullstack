import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomTypeId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ enum: ReservationSource, default: ReservationSource.DIRECT })
  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;

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
