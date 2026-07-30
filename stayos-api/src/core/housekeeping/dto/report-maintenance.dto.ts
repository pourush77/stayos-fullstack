import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum HousekeepingMaintenancePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class ReportMaintenanceDto {
  @ApiProperty({ example: 'AC not cooling', minLength: 2 })
  @IsString()
  @MinLength(2)
  issue!: string;

  @ApiProperty({
    enum: HousekeepingMaintenancePriority,
    example: HousekeepingMaintenancePriority.MEDIUM,
  })
  @IsEnum(HousekeepingMaintenancePriority)
  priority!: HousekeepingMaintenancePriority;

  @ApiPropertyOptional({ example: 'Guest reported low cooling before checkout.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
