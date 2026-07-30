import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { EmployeeDepartment } from '../domain/employee-department.enum';
import { EmployeeStatus } from '../domain/employee-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class EmployeeQueryDto {
  @ApiPropertyOptional({ enum: EmployeeDepartment })
  @IsOptional()
  @IsEnum(EmployeeDepartment)
  department?: EmployeeDepartment;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;
}
