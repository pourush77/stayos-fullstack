import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { Permissions } from '../../auth/permissions';
import {
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../../common/decorators/api-standard-response.decorator';
import {
  ActivityFeedItemDto,
  ActivityFeedQueryDto,
  AvailableRoomDto,
  AvailableRoomsQueryDto,
  NeedsAttentionItemDto,
  RoomBoardItemDto,
  RoomDrawerDto,
} from '../dto/operations.dto';
import { ActivityFeedService } from '../services/activity-feed.service';
import { NeedsAttentionService } from '../services/needs-attention.service';
import { RoomAvailabilityService } from '../services/room-availability.service';
import { RoomBoardService } from '../services/room-board.service';
import { RoomDetailsService } from '../services/room-details.service';

@ApiTags('Operations')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class OperationsController {
  constructor(
    private readonly roomBoardService: RoomBoardService,
    private readonly roomDetailsService: RoomDetailsService,
    private readonly roomAvailabilityService: RoomAvailabilityService,
    private readonly needsAttentionService: NeedsAttentionService,
    private readonly activityFeedService: ActivityFeedService,
  ) {}

  @Get('operations/room-board')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Get operational room board',
    description:
      'Returns a UI-ready room board containing room, floor, room type, current stay, attention, and primary action data.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiStandardListResponse(RoomBoardItemDto)
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  getRoomBoard(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<RoomBoardItemDto[]> {
    return this.roomBoardService.getRoomBoard(propertyId);
  }

  @Get('operations/rooms/:roomId')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Get operational room drawer',
    description:
      'Returns all data needed to render the room drawer, including current reservation, guest, upcoming reservation, available actions, recent activity, and audit timeline.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'roomId', format: 'uuid' })
  @ApiStandardOkResponse(RoomDrawerDto)
  @ApiNotFoundResponse({ description: 'Property or room not found. Stable code: ROOM_NOT_FOUND.' })
  getRoomDetails(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<RoomDrawerDto> {
    return this.roomDetailsService.getRoomDetails(propertyId, roomId);
  }

  @Get('operations/available-rooms')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Get assignable rooms',
    description:
      'Returns only rooms eligible for assignment after excluding occupied, unavailable, conflicting, mismatched, and over-capacity rooms.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiQuery({ name: 'arrivalDate', required: false, type: String, example: '2026-07-15' })
  @ApiQuery({ name: 'departureDate', required: false, type: String, example: '2026-07-17' })
  @ApiQuery({ name: 'roomTypeId', required: false, type: String })
  @ApiQuery({ name: 'guestCount', required: false, type: Number })
  @ApiQuery({ name: 'adults', required: false, type: Number })
  @ApiQuery({ name: 'children', required: false, type: Number })
  @ApiQuery({ name: 'accessible', required: false, type: Boolean })
  @ApiQuery({ name: 'connecting', required: false, type: Boolean })
  @ApiQuery({ name: 'vipPreferred', required: false, type: Boolean })
  @ApiStandardListResponse(AvailableRoomDto)
  @ApiBadRequestResponse({
    description: 'Invalid availability query. Stable code: VALIDATION_ERROR.',
  })
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  getAvailableRooms(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: AvailableRoomsQueryDto,
  ): Promise<AvailableRoomDto[]> {
    return this.roomAvailabilityService.getAvailableRooms(propertyId, query);
  }

  @Get('operations/needs-attention')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Get operational needs-attention list',
    description:
      'Returns receptionist-facing operational issues such as unassigned arrivals, VIP arrivals, maintenance rooms, delayed cleaning, departures, and pending payments.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiStandardListResponse(NeedsAttentionItemDto)
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  getNeedsAttention(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<NeedsAttentionItemDto[]> {
    return this.needsAttentionService.getNeedsAttention(propertyId);
  }

  @Get('activity')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Get property activity feed',
    description:
      'Returns recent backend-generated activity events for room, front desk, dashboard, and future assistant surfaces.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiStandardListResponse(ActivityFeedItemDto)
  @ApiBadRequestResponse({ description: 'Invalid activity query. Stable code: VALIDATION_ERROR.' })
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  getActivityFeed(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<ActivityFeedItemDto[]> {
    return this.activityFeedService.getActivityFeed(propertyId, query);
  }
}
