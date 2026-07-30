import { ApiProperty } from '@nestjs/swagger';
import { HousekeepingRoomResponseDto } from './housekeeping-room-response.dto';

export class HousekeepingDashboardSummaryDto {
  @ApiProperty()
  needsCleaning!: number;

  @ApiProperty()
  inProgress!: number;

  @ApiProperty()
  inspection!: number;

  @ApiProperty()
  readyToday!: number;

  @ApiProperty()
  maintenance!: number;
}

export class HousekeepingDashboardDto {
  @ApiProperty({ type: HousekeepingDashboardSummaryDto })
  summary!: HousekeepingDashboardSummaryDto;

  @ApiProperty({ type: [HousekeepingRoomResponseDto] })
  rooms!: HousekeepingRoomResponseDto[];
}
