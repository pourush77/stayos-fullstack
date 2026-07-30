import { Injectable } from '@nestjs/common';
import { ReportsOverviewDto } from './dto/reports.dto';
import { GuestLoyaltyReportService } from './guest-loyalty-report.service';
import { OccupancyReportService } from './occupancy-report.service';
import { OperationsReportService } from './operations-report.service';
import { parseReportRange } from './reports-range';
import { RevenueReportService } from './revenue-report.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly occupancyReportService: OccupancyReportService,
    private readonly revenueReportService: RevenueReportService,
    private readonly operationsReportService: OperationsReportService,
    private readonly guestLoyaltyReportService: GuestLoyaltyReportService,
  ) {}

  range(from?: string, to?: string) {
    return parseReportRange(from, to);
  }

  async getOverview(propertyId: string, from?: string, to?: string): Promise<ReportsOverviewDto> {
    const range = this.range(from, to);
    const occupancy = await this.occupancyReportService.getOccupancy(propertyId, range);
    const [revenue, operations] = await Promise.all([
      this.revenueReportService.getRevenue(propertyId, range, occupancy),
      this.operationsReportService.getOperations(propertyId, range),
    ]);

    return {
      occupancyPercent: occupancy.occupancyPercent,
      adr: revenue.adr,
      revPar: revenue.revPar,
      revenue: revenue.totalRevenue,
      arrivals: operations.arrivals,
      departures: operations.departures,
      openRequests: operations.openRequests,
      avgRequestResolutionMinutes: operations.avgRequestResolutionMinutes,
    };
  }

  async exportCsv(propertyId: string, from?: string, to?: string): Promise<string> {
    const overview = await this.getOverview(propertyId, from, to);
    return [
      'metric,value',
      `occupancyPercent,${overview.occupancyPercent}`,
      `adr,${overview.adr}`,
      `revPar,${overview.revPar}`,
      `revenue,${overview.revenue}`,
      `arrivals,${overview.arrivals}`,
      `departures,${overview.departures}`,
      `openRequests,${overview.openRequests}`,
      `avgRequestResolutionMinutes,${overview.avgRequestResolutionMinutes}`,
    ].join('\n');
  }

  getOccupancy(propertyId: string, from?: string, to?: string) {
    return this.occupancyReportService.getOccupancy(propertyId, this.range(from, to));
  }

  async getRevenue(propertyId: string, from?: string, to?: string) {
    const range = this.range(from, to);
    const occupancy = await this.occupancyReportService.getOccupancy(propertyId, range);
    return this.revenueReportService.getRevenue(propertyId, range, occupancy);
  }

  getOperations(propertyId: string, from?: string, to?: string) {
    return this.operationsReportService.getOperations(propertyId, this.range(from, to));
  }

  getTopGuests(propertyId: string, from?: string, to?: string) {
    return this.guestLoyaltyReportService.getTopGuests(propertyId, this.range(from, to));
  }
}
