import { ApiProperty } from '@nestjs/swagger';
import { EmployeeDepartment } from '../../employees/domain/employee-department.enum';
import { HousekeepingChecklistItem } from '../domain/housekeeping-checklist';
import { HousekeepingRoomStatus } from './housekeeping-room-response.dto';

export class HousekeepingStaffAccessEmployeeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  employeeCode!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: EmployeeDepartment })
  department!: EmployeeDepartment;
}

export class HousekeepingStaffAccessRoomDto {
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

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  checklist!: HousekeepingChecklistItem[];

  @ApiProperty({ nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ nullable: true })
  reworkReason!: string | null;
}

export class HousekeepingStaffAccessResponseDto {
  @ApiProperty({ type: HousekeepingStaffAccessEmployeeDto })
  employee!: HousekeepingStaffAccessEmployeeDto;

  @ApiProperty({ type: [HousekeepingStaffAccessRoomDto] })
  rooms!: HousekeepingStaffAccessRoomDto[];
}
