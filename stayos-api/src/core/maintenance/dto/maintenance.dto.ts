import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MaintenanceTicketCategory } from '../domain/maintenance-ticket-category.enum';
import { MaintenanceTicketPriority } from '../domain/maintenance-ticket-priority.enum';
import { MaintenanceTicketStatus } from '../domain/maintenance-ticket-status.enum';

export class MaintenanceTicketQueryDto {
  @IsOptional()
  @IsEnum(MaintenanceTicketStatus)
  status?: MaintenanceTicketStatus;
}

export class CreateMaintenanceTicketDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsEnum(MaintenanceTicketCategory)
  category!: MaintenanceTicketCategory;

  @IsOptional()
  @IsEnum(MaintenanceTicketPriority)
  priority?: MaintenanceTicketPriority;
}

export class UpdateMaintenanceTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MaintenanceTicketCategory)
  category?: MaintenanceTicketCategory;

  @IsOptional()
  @IsEnum(MaintenanceTicketPriority)
  priority?: MaintenanceTicketPriority;
}

export class AssignMaintenanceTicketDto {
  @IsUUID()
  assignedToUserId!: string;
}

export class ResolveMaintenanceTicketDto {
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class MaintenanceSummaryDto {
  @ApiProperty()
  open!: number;
  @ApiProperty()
  inProgress!: number;
  @ApiProperty()
  resolved!: number;
  @ApiProperty()
  highPriority!: number;
}

export class MaintenanceTicketResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  propertyId!: string;
  @ApiPropertyOptional()
  roomId!: string | null;
  @ApiPropertyOptional()
  roomNumber!: string | null;
  @ApiProperty()
  reportedByUserId!: string;
  @ApiPropertyOptional()
  assignedToUserId!: string | null;
  @ApiProperty()
  title!: string;
  @ApiPropertyOptional()
  description!: string | null;
  @ApiProperty({ enum: MaintenanceTicketCategory })
  category!: MaintenanceTicketCategory;
  @ApiProperty({ enum: MaintenanceTicketPriority })
  priority!: MaintenanceTicketPriority;
  @ApiProperty({ enum: MaintenanceTicketStatus })
  status!: MaintenanceTicketStatus;
  @ApiProperty()
  reportedAt!: Date;
  @ApiPropertyOptional()
  resolvedAt!: Date | null;
  @ApiPropertyOptional()
  resolutionNote!: string | null;
}
