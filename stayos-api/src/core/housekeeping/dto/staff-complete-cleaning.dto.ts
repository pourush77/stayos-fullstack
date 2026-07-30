import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { HousekeepingChecklistItemDto } from './complete-cleaning.dto';

export class StaffCompleteCleaningDto {
  @ApiProperty({ type: [HousekeepingChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HousekeepingChecklistItemDto)
  checklist!: HousekeepingChecklistItemDto[];
}
