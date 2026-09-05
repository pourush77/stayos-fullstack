import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NightAuditRunStatus } from '../domain/night-audit-run-status.enum';
import { NightAuditValidationDto } from './night-audit-validation.dto';
import { NightAuditWorkspaceDto } from './night-audit-workspace.dto';

export class NightAuditRunResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ example: '2026-09-04' })
  businessDate!: string;

  @ApiProperty({ enum: NightAuditRunStatus })
  status!: NightAuditRunStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  startedByUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  completedByUserId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  summary?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: '2026-09-05', nullable: true })
  nextBusinessDate?: string | null;

  @ApiPropertyOptional({ type: () => NightAuditWorkspaceDto })
  workspace?: NightAuditWorkspaceDto;

  @ApiPropertyOptional({ type: () => NightAuditValidationDto })
  validation?: NightAuditValidationDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

