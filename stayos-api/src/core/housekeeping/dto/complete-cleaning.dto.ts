import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { HousekeepingChecklistKey } from '../domain/housekeeping-checklist';

export class HousekeepingChecklistItemDto {
  @ApiProperty({ enum: HousekeepingChecklistKey })
  @IsEnum(HousekeepingChecklistKey)
  key!: HousekeepingChecklistKey;

  @ApiProperty()
  @IsBoolean()
  completed!: boolean;
}

export class CompleteCleaningDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  completedOnBehalf?: boolean;

  @ApiProperty({ type: [HousekeepingChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HousekeepingChecklistItemDto)
  checklist!: HousekeepingChecklistItemDto[];
}
