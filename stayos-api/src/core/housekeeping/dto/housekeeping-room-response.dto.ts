import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HousekeepingRoomStatus {
  READY = 'READY',
  OCCUPIED = 'OCCUPIED',
  NEEDS_CLEANING = 'NEEDS_CLEANING',
  CLEANING = 'CLEANING',
  INSPECTION = 'INSPECTION',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum HousekeepingRoomPriority {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum HousekeepingPrimaryAction {
  ASSIGN_STAFF = 'ASSIGN_STAFF',
  START_CLEANING = 'START_CLEANING',
  COMPLETE_CLEANING = 'COMPLETE_CLEANING',
  MARK_READY = 'MARK_READY',
  REPORT_MAINTENANCE = 'REPORT_MAINTENANCE',
  NONE = 'NONE',
}

export class HousekeepingRoomResponseDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty()
  roomNumber!: string;

  @ApiProperty()
  roomType!: string;

  @ApiProperty()
  floor!: string;

  @ApiProperty({ enum: HousekeepingRoomStatus })
  status!: HousekeepingRoomStatus;

  @ApiProperty({ enum: HousekeepingRoomPriority })
  priority!: HousekeepingRoomPriority;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedEmployeeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  assignedStaff!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  lastActivityAt!: Date;

  @ApiProperty({ enum: HousekeepingPrimaryAction })
  primaryAction!: HousekeepingPrimaryAction;
}
