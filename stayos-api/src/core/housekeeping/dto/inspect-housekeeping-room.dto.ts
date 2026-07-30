import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export enum HousekeepingInspectionAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class InspectHousekeepingRoomDto {
  @ApiProperty({ enum: HousekeepingInspectionAction })
  @IsEnum(HousekeepingInspectionAction)
  action!: HousekeepingInspectionAction;

  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf(
    (dto: InspectHousekeepingRoomDto) => dto.action === HousekeepingInspectionAction.REJECT,
  )
  @IsString()
  @Length(1, 1000)
  reworkReason?: string;
}
