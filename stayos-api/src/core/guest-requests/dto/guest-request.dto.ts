import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { GuestRequestDepartment } from '../domain/guest-request-department.enum';
import { GuestRequestPriority } from '../domain/guest-request-priority.enum';
import { GuestRequestStatus } from '../domain/guest-request-status.enum';
import { GuestRequestType } from '../domain/guest-request-type.enum';

export class GuestRequestQueryDto {
  @IsOptional()
  @IsEnum(GuestRequestStatus)
  status?: GuestRequestStatus;

  @IsOptional()
  @IsEnum(GuestRequestDepartment)
  department?: GuestRequestDepartment;

  @IsOptional()
  @IsEnum(GuestRequestType)
  requestType?: GuestRequestType;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateGuestRequestDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    enum: GuestRequestType,
    description: 'Stable Guest Services request type.',
  })
  @IsOptional()
  @IsEnum(GuestRequestType)
  requestType?: GuestRequestType;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Service-specific information such as destination, passengers, flight number, quantity, or other guided form details.',
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ enum: GuestRequestPriority })
  @IsOptional()
  @IsEnum(GuestRequestPriority)
  priority?: GuestRequestPriority;

  @ApiPropertyOptional({ enum: GuestRequestDepartment })
  @IsOptional()
  @IsEnum(GuestRequestDepartment)
  department?: GuestRequestDepartment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueAt?: string;
}

export class UpdateGuestRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: GuestRequestType })
  @IsOptional()
  @IsEnum(GuestRequestType)
  requestType?: GuestRequestType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GuestRequestPriority)
  priority?: GuestRequestPriority;

  @IsOptional()
  @IsEnum(GuestRequestDepartment)
  department?: GuestRequestDepartment;

  @IsOptional()
  @IsString()
  dueAt?: string | null;
}

export class AddGuestRequestNoteDto {
  @IsString()
  body!: string;
}

export class GuestRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  propertyId!: string;

  @ApiPropertyOptional()
  reservationId!: string | null;

  @ApiPropertyOptional()
  guestId!: string | null;

  @ApiPropertyOptional()
  roomId!: string | null;

  @ApiPropertyOptional({ enum: GuestRequestType })
  requestType!: GuestRequestType | null;

  @ApiPropertyOptional({ type: Object })
  details!: Record<string, unknown> | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: GuestRequestStatus })
  status!: GuestRequestStatus;

  @ApiProperty({ enum: GuestRequestPriority })
  priority!: GuestRequestPriority;

  @ApiProperty({ enum: GuestRequestDepartment })
  department!: GuestRequestDepartment;

  @ApiProperty()
  overdue!: boolean;

  @ApiPropertyOptional()
  guestDisplayName!: string | null;

  @ApiPropertyOptional()
  roomNumber!: string | null;

  @ApiPropertyOptional()
  reservationCode!: string | null;

  @ApiPropertyOptional()
  assignedEmployeeName!: string | null;

  @ApiPropertyOptional()
  dueAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class GuestRequestSummaryDto {
  @ApiProperty()
  active!: number;

  @ApiProperty()
  awaitingAction!: number;

  @ApiProperty()
  completedToday!: number;

  @ApiProperty()
  highPriority!: number;

  @ApiProperty()
  vip!: number;

  @ApiProperty()
  overdue!: number;
}
