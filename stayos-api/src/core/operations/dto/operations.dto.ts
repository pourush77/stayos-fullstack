import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { GroupBookingSource } from '../domain/group-booking-source.enum';
import { GroupBookingStatus } from '../domain/group-booking-status.enum';

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

export enum GroupRoomMixPreference {
  BEST_FIT = 'BEST_FIT',
  COMFORT = 'COMFORT',
  BUDGET = 'BUDGET',
}

export enum GroupRoomMixOptionType {
  BEST_FIT = 'BEST_FIT',
  COMFORT = 'COMFORT',
  BUDGET = 'BUDGET',
  MAX_CAPACITY = 'MAX_CAPACITY',
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

export class GroupContextDto {
  @ApiProperty({ format: 'uuid' })
  groupBookingId!: string;

  @ApiProperty()
  groupCode!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty()
  masterFolioId!: string;

  @ApiProperty()
  masterFolioNumber!: string;

  @ApiProperty()
  status!: string;
}

export class GroupMasterFolioRoomDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiProperty()
  roomTypeName!: string;

  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;
}

export class GroupMasterFolioChargeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  currency!: string;
}

export class GroupMasterFolioPaymentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  method!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  receivedAt!: string;
}

export class GroupMasterFolioCheckoutSummaryDto {
  @ApiProperty()
  balanceDue!: number;

  @ApiProperty()
  occupiedRoomCount!: number;

  @ApiProperty()
  checkoutEligible!: boolean;

  @ApiProperty({ type: [String] })
  checkoutBlockers!: string[];
}

export class PostGroupMasterFolioChargeDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  quantity?: number;
}

export class PostGroupMasterFolioPaymentDto {
  @ApiProperty()
  @IsString()
  method!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class GroupMasterFolioDetailDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupBookingId!: string;

  @ApiProperty()
  groupCode!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty({ format: 'date' })
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  departureDate!: string;

  @ApiProperty()
  folioNumber!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  estimatedTotal!: number;

  @ApiProperty({ type: [GroupMasterFolioRoomDto] })
  rooms!: GroupMasterFolioRoomDto[];

  @ApiProperty({ type: [GroupMasterFolioChargeDto] })
  charges!: GroupMasterFolioChargeDto[];

  @ApiProperty({ type: [GroupMasterFolioPaymentDto] })
  payments!: GroupMasterFolioPaymentDto[];

  @ApiProperty({ type: GroupMasterFolioCheckoutSummaryDto })
  checkoutSummary!: GroupMasterFolioCheckoutSummaryDto;
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

  @ApiPropertyOptional({ type: GroupContextDto })
  groupContext!: GroupContextDto | null;

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

export class GroupRoomMixSuggestionQueryDto {
  @ApiProperty({ format: 'date' })
  @IsDateString()
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  departureDate!: string;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  children!: number;

  @ApiPropertyOptional({ enum: GroupRoomMixPreference, default: GroupRoomMixPreference.BEST_FIT })
  @IsOptional()
  @IsEnum(GroupRoomMixPreference)
  preference?: GroupRoomMixPreference;
}

export class GroupRoomMixAvailabilityDto {
  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiProperty()
  roomTypeCode!: string;

  @ApiProperty()
  roomTypeName!: string;

  @ApiProperty()
  availableRooms!: number;

  @ApiProperty()
  maxAdults!: number;

  @ApiProperty()
  maxChildren!: number;

  @ApiProperty()
  maxOccupancy!: number;

  @ApiProperty()
  baseRate!: number;
}

export class GroupRoomMixBlockDto {
  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiProperty()
  roomTypeCode!: string;

  @ApiProperty()
  roomTypeName!: string;

  @ApiProperty()
  rooms!: number;

  @ApiProperty()
  adultsPerRoom!: number;

  @ApiProperty()
  childrenPerRoom!: number;

  @ApiProperty()
  maxAdults!: number;

  @ApiProperty()
  maxChildren!: number;

  @ApiProperty()
  maxOccupancy!: number;

  @ApiProperty()
  baseRate!: number;

  @ApiProperty()
  estimatedTotal!: number;
}

export class GroupRoomMixOptionDto {
  @ApiProperty({ enum: GroupRoomMixOptionType })
  type!: GroupRoomMixOptionType;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ type: [GroupRoomMixBlockDto] })
  roomBlocks!: GroupRoomMixBlockDto[];

  @ApiProperty()
  totalRooms!: number;

  @ApiProperty()
  adultCapacity!: number;

  @ApiProperty()
  childCapacity!: number;

  @ApiProperty()
  totalCapacity!: number;

  @ApiProperty()
  spareCapacity!: number;

  @ApiProperty()
  estimatedTotal!: number;

  @ApiProperty()
  canCreateHold!: boolean;

  @ApiProperty()
  canCreateWalkInGroup!: boolean;
}

export class GroupRoomMixSuggestionDto {
  @ApiProperty({ format: 'date' })
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  departureDate!: string;

  @ApiProperty()
  adults!: number;

  @ApiProperty()
  children!: number;

  @ApiProperty()
  nights!: number;

  @ApiProperty({ type: [GroupRoomMixAvailabilityDto] })
  availability!: GroupRoomMixAvailabilityDto[];

  @ApiProperty({ type: [GroupRoomMixOptionDto] })
  options!: GroupRoomMixOptionDto[];

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiProperty()
  channelManagerSyncReady!: boolean;
}

export class CreateGroupHoldRoomBlockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomTypeId!: string;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  rooms!: number;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  adultsPerRoom!: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  childrenPerRoom!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRate?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedTotal?: number;
}

export class CreateGroupHoldDto {
  @ApiProperty({ example: 'Sharma Family Reunion' })
  @IsString()
  groupName!: string;

  @ApiProperty({ example: 'Rajat Sharma' })
  @IsString()
  leadName!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  leadPhone!: string;

  @ApiPropertyOptional({ example: 'rajat@example.com' })
  @IsOptional()
  @IsString()
  leadEmail?: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  departureDate!: string;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  children!: number;

  @ApiProperty({ enum: GroupBookingSource })
  @IsEnum(GroupBookingSource)
  source!: GroupBookingSource;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  releaseAt?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositRequired?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateGroupHoldRoomBlockDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGroupHoldRoomBlockDto)
  roomBlocks!: CreateGroupHoldRoomBlockDto[];
}

export class GroupHoldRoomBlockDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiProperty()
  roomTypeName!: string;

  @ApiProperty()
  rooms!: number;

  @ApiProperty()
  adultsPerRoom!: number;

  @ApiProperty()
  childrenPerRoom!: number;

  @ApiProperty()
  baseRate!: number;

  @ApiProperty()
  estimatedTotal!: number;
}

export class GroupRoomingListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  guestName!: string;

  @ApiProperty()
  adults!: number;

  @ApiProperty()
  children!: number;

  @ApiPropertyOptional()
  phone!: string | null;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  assignedRoomId!: string | null;
}

export class GroupRoomAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiProperty({ format: 'uuid' })
  roomTypeId!: string;

  @ApiProperty()
  roomTypeName!: string;
}

export class GroupHoldDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  groupCode!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty()
  leadName!: string;

  @ApiProperty()
  leadPhone!: string;

  @ApiPropertyOptional()
  leadEmail!: string | null;

  @ApiProperty({ format: 'date' })
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  departureDate!: string;

  @ApiProperty()
  adults!: number;

  @ApiProperty()
  children!: number;

  @ApiProperty({ enum: GroupBookingSource })
  source!: GroupBookingSource;

  @ApiProperty({ enum: GroupBookingStatus })
  status!: GroupBookingStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  releaseAt!: Date | null;

  @ApiProperty()
  depositRequired!: number;

  @ApiProperty()
  estimatedTotal!: number;

  @ApiProperty()
  syncStatus!: string;

  @ApiProperty({ type: [GroupHoldRoomBlockDto] })
  roomBlocks!: GroupHoldRoomBlockDto[];

  @ApiProperty({ type: [GroupRoomingListItemDto] })
  roomingList!: GroupRoomingListItemDto[];

  @ApiProperty({ type: [GroupRoomAssignmentDto] })
  roomAssignments!: GroupRoomAssignmentDto[];

  @ApiProperty()
  readiness!: {
    contactComplete: boolean;
    depositRequired: boolean;
    fullyAssigned: boolean;
    releaseDateSet: boolean;
    roomingListStarted: boolean;
    canConfirm: boolean;
  };
}

export class UpdateGroupHoldDto {
  @ApiPropertyOptional({ example: 'Sharma Family Reunion' })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiPropertyOptional({ example: 'Rajat Sharma' })
  @IsOptional()
  @IsString()
  leadName?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  leadPhone?: string;

  @ApiPropertyOptional({ example: 'rajat@example.com' })
  @IsOptional()
  @IsString()
  leadEmail?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  releaseAt?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositRequired?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddGroupRoomingListItemDto {
  @ApiProperty()
  @IsString()
  guestName!: string;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  children!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignGroupRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;
}

export class GroupCheckInRoomPreviewDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiProperty()
  roomTypeName!: string;

  @ApiProperty()
  operationalStatus!: string;

  @ApiProperty()
  ready!: boolean;
}

export class GroupCheckInPreviewDto {
  @ApiProperty({ type: GroupHoldDto })
  group!: GroupHoldDto;

  @ApiProperty()
  canCheckIn!: boolean;

  @ApiProperty({ type: [String] })
  blockers!: string[];

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiProperty({ type: [GroupCheckInRoomPreviewDto] })
  rooms!: GroupCheckInRoomPreviewDto[];

  @ApiProperty()
  folioMode!: 'MASTER_FOLIO_ONLY';
}

export class GroupCheckInResultDto {
  @ApiProperty({ type: GroupHoldDto })
  group!: GroupHoldDto;

  @ApiProperty({ format: 'uuid' })
  groupStayId!: string;

  @ApiProperty({ format: 'uuid' })
  masterFolioId!: string;

  @ApiProperty()
  masterFolioNumber!: string;

  @ApiProperty({ type: [String] })
  occupiedRooms!: string[];
}

export class InHouseGroupDto {
  @ApiProperty({ format: 'uuid' })
  groupBookingId!: string;

  @ApiProperty()
  groupCode!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty()
  leadName!: string;

  @ApiProperty({ format: 'date' })
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  departureDate!: string;

  @ApiProperty()
  masterFolioId!: string;

  @ApiProperty()
  masterFolioNumber!: string;

  @ApiProperty({ type: [String] })
  occupiedRooms!: string[];

  @ApiProperty()
  roomCount!: number;
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


export class WalkInGroupRoomAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'The actual room ID to assign and check-in' })
  @IsUUID()
  roomId!: string;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  children!: number;

  @ApiPropertyOptional({ description: 'Occupant name for this room (optional)' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRate?: number;
}

export class CreateWalkInGroupDto {
  @ApiProperty({ example: 'Sharma Family Reunion' })
  @IsString()
  groupName!: string;

  @ApiProperty({ example: 'Rajat Sharma' })
  @IsString()
  leadName!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  leadPhone!: string;

  @ApiPropertyOptional({ example: 'rajat@example.com' })
  @IsOptional()
  @IsString()
  leadEmail?: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  arrivalDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  departureDate!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedTotal?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositRequired?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [WalkInGroupRoomAssignmentDto],
    description:
      'One entry per physical room to assign & check-in. Rooms are grouped by roomType server-side to build inventory blocks. Backend derives adults & children totals.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WalkInGroupRoomAssignmentDto)
  roomAssignments!: WalkInGroupRoomAssignmentDto[];
}
