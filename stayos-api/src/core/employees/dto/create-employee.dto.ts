import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';
import { EmployeeDepartment } from '../domain/employee-department.enum';
import { EmployeeStatus } from '../domain/employee-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const phonePattern = /^[+0-9][0-9+\-\s()]{6,31}$/;

export class CreateEmployeeDto {
  @ApiPropertyOptional({ example: 'HK-001', maxLength: 32 })
  @Transform(upperTrim)
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^[A-Z0-9-]+$/)
  employeeCode?: string;

  @ApiProperty({ example: 'Ram', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Kumar', maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Ram Kumar', maxLength: 240 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 240)
  displayName?: string;

  @ApiProperty({ enum: EmployeeDepartment })
  @IsEnum(EmployeeDepartment)
  department!: EmployeeDepartment;

  @ApiPropertyOptional({ example: 'Room Attendant', maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  designation?: string;

  @ApiPropertyOptional({ example: '+919876543210', maxLength: 32, nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(7, 32)
  @Matches(phonePattern)
  phone?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_tld: false })
  photoUrl?: string;
}
