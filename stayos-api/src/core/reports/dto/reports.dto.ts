import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReportsRangeQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class ReportsKpiDto {
  @ApiProperty()
  label!: string;
  @ApiProperty()
  value!: number;
  @ApiProperty()
  unit!: string;
}

export class ReportsBreakdownDto {
  @ApiProperty()
  label!: string;
  @ApiProperty()
  value!: number;
}

export class ReportsOverviewDto {
  @ApiProperty()
  occupancyPercent!: number;
  @ApiProperty()
  adr!: number;
  @ApiProperty()
  revPar!: number;
  @ApiProperty()
  revenue!: number;
  @ApiProperty()
  arrivals!: number;
  @ApiProperty()
  departures!: number;
  @ApiProperty()
  openRequests!: number;
  @ApiProperty()
  avgRequestResolutionMinutes!: number;
}

export class ReportsOccupancyDto {
  @ApiProperty()
  totalRooms!: number;
  @ApiProperty()
  roomNightsAvailable!: number;
  @ApiProperty()
  roomNightsOccupied!: number;
  @ApiProperty()
  occupancyPercent!: number;
  @ApiProperty({ type: [ReportsBreakdownDto] })
  bySource!: ReportsBreakdownDto[];
}

export class ReportsRevenueDto {
  @ApiProperty()
  totalRevenue!: number;
  @ApiProperty()
  totalPayments!: number;
  @ApiProperty()
  adr!: number;
  @ApiProperty()
  revPar!: number;
  @ApiProperty({ type: [ReportsBreakdownDto] })
  byChargeType!: ReportsBreakdownDto[];
  @ApiProperty({ type: [ReportsBreakdownDto] })
  byPaymentMethod!: ReportsBreakdownDto[];
}

export class ReportsOperationsDto {
  @ApiProperty()
  arrivals!: number;
  @ApiProperty()
  departures!: number;
  @ApiProperty()
  openRequests!: number;
  @ApiProperty()
  completedRequests!: number;
  @ApiProperty()
  overdueRequests!: number;
  @ApiProperty()
  avgRequestResolutionMinutes!: number;
}

export class TopGuestDto {
  @ApiProperty()
  guestId!: string;
  @ApiProperty()
  guestDisplayName!: string;
  @ApiProperty()
  stays!: number;
  @ApiProperty()
  revenue!: number;
}
