import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeDepartment } from '../domain/employee-department.enum';
import { EmployeeStatus } from '../domain/employee-status.enum';

export class EmployeeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  employeeCode!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: EmployeeDepartment })
  department!: EmployeeDepartment;

  @ApiProperty()
  designation!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: EmployeeStatus })
  status!: EmployeeStatus;

  @ApiPropertyOptional({ nullable: true })
  photoUrl!: string | null;

  @ApiProperty()
  staffAccessEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  staffAccessToken!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
