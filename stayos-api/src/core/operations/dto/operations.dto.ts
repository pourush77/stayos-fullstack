import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';

const toBoolean = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === true || value === 'true';

export enum OperationsRoomUiStatus {
  READY = 'READY',
  OCCUPIED = 'OCCUPIED',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum OperationsAttentionLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum OperationsPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class OperationsFloorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  floorNumber!: number;
}

export class OperationsRoomTypeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class OperationsReservationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty()
  reservationCode!: string;

  @ApiProperty({ format: 'uuid' })
  guestId!: string;

  @ApiProperty()
  guestName!: string;

  @ApiProperty({ format: 'date' })
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  departureDate!: string;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  @ApiProperty({ enum: ReservationPaymentStatus })
  paymentStatus!: ReservationPaymentStatus;
}

export class RoomBoardItemDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiProperty({ type: OperationsFloorDto })
  floor!: OperationsFloorDto;

  @ApiProperty({ type: OperationsRoomTypeDto })
  roomType!: OperationsRoomTypeDto;

  @ApiProperty({ enum: OperationsRoomUiStatus })
  uiStatus!: OperationsRoomUiStatus;

  @ApiProperty({ enum: RoomOperationalStatus })
  operationalStatus!: RoomOperationalStatus;

  @ApiPropertyOptional({ type: OperationsReservationSummaryDto })
  currentStay!: OperationsReservationSummaryDto | null;

  @ApiPropertyOptional({ example: 'Checkout Today' })
  checkoutLabel!: string | null;

  @ApiProperty({ example: 'Open Stay' })
  primaryAction!: string;

  @ApiProperty({ enum: OperationsAttentionLevel })
  attentionLevel!: OperationsAttentionLevel;
}

export class RoomDrawerDto {
  @ApiProperty({ type: RoomBoardItemDto })
  roomSummary!: RoomBoardItemDto;

  @ApiPropertyOptional({ type: OperationsReservationSummaryDto })
  currentReservation!: OperationsReservationSummaryDto | null;

  @ApiPropertyOptional()
  guestSummary!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: OperationsReservationSummaryDto })
  upcomingReservation!: OperationsReservationSummaryDto | null;

  @ApiProperty({ enum: RoomOperationalStatus })
  operationalStatus!: RoomOperationalStatus;

  @ApiProperty({ type: [String] })
  availableActions!: string[];

  @ApiProperty({ type: [Object] })
  recentActivity!: ActivityFeedItemDto[];

  @ApiProperty({ type: [Object] })
  auditTimeline!: Array<Record<string, unknown>>;
}

export class AvailableRoomsQueryDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional()
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  accessible?: boolean;

  @ApiPropertyOptional()
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  connecting?: boolean;

  @ApiPropertyOptional()
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  vipPreferred?: boolean;
}

export class AvailableRoomDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiProperty({ type: OperationsFloorDto })
  floor!: OperationsFloorDto;

  @ApiProperty({ type: OperationsRoomTypeDto })
  roomType!: OperationsRoomTypeDto;

  @ApiProperty({ enum: RoomOperationalStatus })
  operationalStatus!: RoomOperationalStatus;

  @ApiProperty()
  maxOccupancy!: number;

  @ApiProperty()
  primaryAction!: string;
}

export class ActivityFeedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ActivityFeedItemDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: Date;

  @ApiProperty()
  entity!: { type: string; id: string };

  @ApiProperty()
  metadata!: Record<string, unknown>;
}

export class NeedsAttentionItemDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: OperationsPriority })
  priority!: OperationsPriority;

  @ApiProperty()
  relatedEntity!: { type: string; id: string };

  @ApiProperty()
  primaryAction!: string;
}
