import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardListResponse, ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import {
  AssignMaintenanceTicketDto,
  CreateMaintenanceTicketDto,
  MaintenanceSummaryDto,
  MaintenanceTicketQueryDto,
  MaintenanceTicketResponseDto,
  ResolveMaintenanceTicketDto,
  UpdateMaintenanceTicketDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller('properties/:propertyId/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @RequirePermissions(Permissions.MaintenanceView)
  @ApiStandardListResponse(MaintenanceTicketResponseDto)
  findAll(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() query: MaintenanceTicketQueryDto) {
    return this.maintenanceService.findAll(propertyId, query);
  }

  @Get('summary')
  @RequirePermissions(Permissions.MaintenanceView)
  @ApiStandardOkResponse(MaintenanceSummaryDto)
  getSummary(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.maintenanceService.getSummary(propertyId);
  }

  @Post()
  @RequirePermissions(Permissions.MaintenanceManage)
  @ApiOperation({ summary: 'Create maintenance ticket' })
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateMaintenanceTicketDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ) {
    return this.maintenanceService.create(propertyId, dto, user?.id ?? '');
  }

  @Get(':ticketId')
  @RequirePermissions(Permissions.MaintenanceView)
  findOne(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.maintenanceService.findOne(propertyId, ticketId);
  }

  @Patch(':ticketId')
  @RequirePermissions(Permissions.MaintenanceManage)
  update(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: UpdateMaintenanceTicketDto) {
    return this.maintenanceService.update(propertyId, ticketId, dto);
  }

  @Patch(':ticketId/assign')
  @RequirePermissions(Permissions.MaintenanceManage)
  assign(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: AssignMaintenanceTicketDto) {
    return this.maintenanceService.assign(propertyId, ticketId, dto);
  }

  @Patch(':ticketId/resolve')
  @RequirePermissions(Permissions.MaintenanceManage)
  resolve(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: ResolveMaintenanceTicketDto) {
    return this.maintenanceService.resolve(propertyId, ticketId, dto);
  }

  @Patch(':ticketId/cancel')
  @RequirePermissions(Permissions.MaintenanceManage)
  cancel(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.maintenanceService.cancel(propertyId, ticketId);
  }
}
