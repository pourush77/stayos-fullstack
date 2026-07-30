import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { Permissions } from '../auth/permissions';
import { AssignHousekeepingRoomDto } from './dto/assign-housekeeping-room.dto';
import { CompleteCleaningDto } from './dto/complete-cleaning.dto';
import { HousekeepingDashboardDto } from './dto/housekeeping-dashboard.dto';
import { HousekeepingRoomResponseDto } from './dto/housekeeping-room-response.dto';
import { InspectHousekeepingRoomDto } from './dto/inspect-housekeeping-room.dto';
import { ReportMaintenanceDto } from './dto/report-maintenance.dto';
import { StaffCompleteCleaningDto } from './dto/staff-complete-cleaning.dto';
import { HousekeepingStaffAccessResponseDto } from './dto/staff-access-response.dto';
import { HousekeepingService } from './housekeeping.service';

@ApiTags('Housekeeping')
@ApiBearerAuth()
@Controller('properties/:propertyId/housekeeping')
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Public()
  @Get('staff/access/:token')
  @ApiOperation({ summary: 'Get token-based housekeeping staff worklist' })
  @ApiStandardOkResponse(HousekeepingStaffAccessResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid or disabled staff access token' })
  getStaffAccess(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('token') token: string,
  ): Promise<HousekeepingStaffAccessResponseDto> {
    return this.housekeepingService.getStaffAccess(propertyId, token);
  }

  @Public()
  @Patch('staff/access/:token/rooms/:roomId/start')
  @ApiOperation({ summary: 'Start an assigned room from token-based staff access' })
  @ApiStandardOkResponse(HousekeepingStaffAccessResponseDto)
  @ApiBadRequestResponse({
    description: 'Invalid token, denied room access, or invalid room state',
  })
  staffStartRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('token') token: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<HousekeepingStaffAccessResponseDto> {
    return this.housekeepingService.startStaffAssignedRoom(propertyId, token, roomId);
  }

  @Public()
  @Patch('staff/access/:token/rooms/:roomId/complete')
  @ApiOperation({ summary: 'Complete an assigned room from token-based staff access' })
  @ApiStandardOkResponse(HousekeepingStaffAccessResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid token, denied room access, or invalid checklist' })
  staffCompleteRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('token') token: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() completeDto: StaffCompleteCleaningDto,
  ): Promise<HousekeepingStaffAccessResponseDto> {
    return this.housekeepingService.completeStaffAssignedRoom(
      propertyId,
      token,
      roomId,
      completeDto,
    );
  }

  @Get('dashboard')
  @RequirePermissions(Permissions.HousekeepingView)
  @ApiOperation({ summary: 'Get housekeeping dashboard for a property' })
  @ApiStandardOkResponse(HousekeepingDashboardDto)
  @ApiForbiddenResponse({ description: 'Missing housekeeping.view permission' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  getDashboard(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<HousekeepingDashboardDto> {
    return this.housekeepingService.getDashboard(propertyId);
  }

  @Patch('rooms/:roomId/assign')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Assign a housekeeping employee to a room' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Employee is inactive or not housekeeping' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property, room, or employee not found' })
  assignEmployee(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() assignDto: AssignHousekeepingRoomDto,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.assignEmployee(propertyId, roomId, assignDto, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/start')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Start room cleaning' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Room is not assigned or not in cleaning status' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  start(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.startCleaning(propertyId, roomId, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/start-cleaning')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Record room cleaning started' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Room is not in cleaning status' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  startCleaning(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.startCleaning(propertyId, roomId, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/complete-cleaning')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Complete cleaning and send room for inspection' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Room is not in cleaning status' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  completeCleaning(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.completeCleaning(propertyId, roomId, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/complete')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Complete cleaning and send room for inspection' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Checklist invalid or room is not ready for completion' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property, room, or employee not found' })
  complete(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() completeDto: CompleteCleaningDto,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.completeCleaning(propertyId, roomId, completeDto, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/inspect')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Approve or reject a completed housekeeping room' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid inspection action or room is not in inspection' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  inspect(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() inspectDto: InspectHousekeepingRoomDto,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.inspect(propertyId, roomId, inspectDto, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/mark-ready')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.RoomsStatusManage)
  @ApiOperation({ summary: 'Mark inspected room ready' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Room must be in inspection status' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or room status permission' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  markReady(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.markReady(propertyId, roomId, {
      actorId: currentUser?.id ?? null,
    });
  }

  @Patch('rooms/:roomId/report-maintenance')
  @RequirePermissions(Permissions.HousekeepingManage, Permissions.MaintenanceManage)
  @ApiOperation({ summary: 'Report maintenance discovered by housekeeping' })
  @ApiStandardOkResponse(HousekeepingRoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid maintenance report or room state' })
  @ApiForbiddenResponse({ description: 'Missing housekeeping or maintenance permission' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  reportMaintenance(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() reportMaintenanceDto: ReportMaintenanceDto,
    @CurrentUser() currentUser: AuthUserDto,
  ): Promise<HousekeepingRoomResponseDto> {
    return this.housekeepingService.reportMaintenance(propertyId, roomId, reportMaintenanceDto, {
      actorId: currentUser?.id ?? null,
    });
  }
}
