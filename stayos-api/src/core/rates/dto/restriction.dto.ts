import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * Bulk upsert of restrictions across an inclusive date range for one
 * (roomType, optional ratePlan) scope. Only the fields provided are written;
 * omitted fields are left unchanged on existing rows (NULL = inherit).
 */
export class UpsertRestrictionsDto {
  @ApiProperty()
  @IsUUID()
  roomTypeId!: string;

  @ApiPropertyOptional({ description: 'NULL/omitted = roomType-level baseline (all plans)' })
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-07' })
  @IsDateString()
  dateTo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stopSell?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cta?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ctd?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minStay?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxStay?: number;
}

export class ListRestrictionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
