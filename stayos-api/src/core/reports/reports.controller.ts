import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardListResponse, ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { ReportsOccupancyDto, ReportsOperationsDto, ReportsOverviewDto, ReportsRangeQueryDto, ReportsRevenueDto, TopGuestDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('properties/:propertyId/reports')
@RequirePermissions(Permissions.ReportsView)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get reports overview KPIs' })
  @ApiStandardOkResponse(ReportsOverviewDto)
  getOverview(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: ReportsRangeQueryDto) {
    return this.reportsService.getOverview(propertyId, query.from, query.to);
  }

  @Get('occupancy')
  @ApiStandardOkResponse(ReportsOccupancyDto)
  getOccupancy(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: ReportsRangeQueryDto) {
    return this.reportsService.getOccupancy(propertyId, query.from, query.to);
  }

  @Get('revenue')
  @ApiStandardOkResponse(ReportsRevenueDto)
  getRevenue(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: ReportsRangeQueryDto) {
    return this.reportsService.getRevenue(propertyId, query.from, query.to);
  }

  @Get('operations')
  @ApiStandardOkResponse(ReportsOperationsDto)
  getOperations(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: ReportsRangeQueryDto) {
    return this.reportsService.getOperations(propertyId, query.from, query.to);
  }

  @Get('top-guests')
  @ApiStandardListResponse(TopGuestDto)
  getTopGuests(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: ReportsRangeQueryDto) {
    return this.reportsService.getTopGuests(propertyId, query.from, query.to);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  exportCsv(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: ReportsRangeQueryDto) {
    return this.reportsService.exportCsv(propertyId, query.from, query.to);
  }
}
