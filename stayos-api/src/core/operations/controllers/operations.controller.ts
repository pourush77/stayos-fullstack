import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
  AddGroupRoomingListItemDto,
  AssignGroupRoomDto,
  AssignableReservationDto,
  AssignableReservationsQueryDto,
  AvailableRoomDto,
  AvailableRoomsQueryDto,
  CreateGroupHoldDto,
  CreateWalkInGroupDto,
  GroupCheckInPreviewDto,
  GroupCheckInResultDto,
  GroupHoldDto,
  GroupMasterFolioDetailDto,
  GroupRoomMixSuggestionDto,
  GroupRoomMixSuggestionQueryDto,
  InHouseGroupDto,
  PostGroupMasterFolioChargeDto,
  PostGroupMasterFolioPaymentDto,
  NeedsAttentionItemDto,
  RoomBoardItemDto,
  RoomDrawerDto,
  UpdateGroupHoldDto,
} from '../dto/operations.dto';
import { ActivityFeedService } from '../services/activity-feed.service';
import { AssignableReservationsService } from '../services/assignable-reservations.service';
import { GroupBookingService } from '../services/group-booking.service';
import { GroupRoomMixService } from '../services/group-room-mix.service';
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
    private readonly groupBookingService: GroupBookingService,
    private readonly groupRoomMixService: GroupRoomMixService,
    private readonly needsAttentionService: NeedsAttentionService,
    private readonly activityFeedService: ActivityFeedService,
    private readonly assignableReservationsService: AssignableReservationsService,
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

  @Get('operations/assignable-reservations')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Get reservations eligible for room assignment',
    description:
      'Returns only unassigned, operationally valid reservations. When roomId is supplied, results are filtered to reservations compatible with that room.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiStandardListResponse(AssignableReservationDto)
  @ApiBadRequestResponse({
    description: 'Room is not assignable or query is invalid. Stable code: VALIDATION_ERROR.',
  })
  @ApiNotFoundResponse({ description: 'Property or room not found. Stable code: NOT_FOUND.' })
  getAssignableReservations(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: AssignableReservationsQueryDto,
  ): Promise<AssignableReservationDto[]> {
    return this.assignableReservationsService.getAssignableReservations(propertyId, query);
  }

  @Get('operations/group-room-mix-suggestions')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Suggest room mixes for group and family bookings',
    description:
      'Returns PMS-owned group room mix recommendations from current assignable inventory. This is designed for phone, walk-in, corporate, travel-agent, and future channel-manager sourced group workflows.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiQuery({ name: 'arrivalDate', required: true, type: String, example: '2026-08-03' })
  @ApiQuery({ name: 'departureDate', required: true, type: String, example: '2026-08-05' })
  @ApiQuery({ name: 'adults', required: true, type: Number, example: 10 })
  @ApiQuery({ name: 'children', required: true, type: Number, example: 6 })
  @ApiQuery({ name: 'preference', required: false, enum: ['BEST_FIT', 'COMFORT', 'BUDGET'] })
  @ApiStandardOkResponse(GroupRoomMixSuggestionDto)
  @ApiBadRequestResponse({
    description: 'Invalid group room mix query. Stable code: VALIDATION_ERROR.',
  })
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  suggestGroupRoomMix(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: GroupRoomMixSuggestionQueryDto,
  ): Promise<GroupRoomMixSuggestionDto> {
    return this.groupRoomMixService.suggestRoomMix(propertyId, query);
  }

  @Post('operations/group-holds')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Create a group inventory hold',
    description:
      'Creates a PMS-owned group booking master with room-type inventory blocks. Room numbers are intentionally not assigned yet, matching the eZee-style group hold workflow.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  @ApiBadRequestResponse({
    description:
      'Invalid group hold request or insufficient inventory. Stable code: VALIDATION_ERROR.',
  })
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  createGroupHold(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateGroupHoldDto,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.createHold(propertyId, dto);
  }

  @Get('operations/group-holds')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'List group inventory holds',
    description:
      'Returns group booking masters and their room-type blocks for operational screens.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiStandardListResponse(GroupHoldDto)
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  getGroupHolds(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<GroupHoldDto[]> {
    return this.groupBookingService.listHolds(propertyId);
  }

  @Get('operations/group-holds/:groupHoldId')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Get group hold details' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  @ApiNotFoundResponse({ description: 'Group hold not found. Stable code: NOT_FOUND.' })
  getGroupHold(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.getHold(propertyId, groupHoldId);
  }

  @Patch('operations/group-holds/:groupHoldId')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Update group hold terms and lead details' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  @ApiBadRequestResponse({
    description: 'Group hold cannot be edited. Stable code: VALIDATION_ERROR.',
  })
  @ApiNotFoundResponse({ description: 'Group hold not found. Stable code: NOT_FOUND.' })
  updateGroupHold(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
    @Body() dto: UpdateGroupHoldDto,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.updateHold(propertyId, groupHoldId, dto);
  }

  @Post('operations/group-holds/:groupHoldId/release')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Release group hold inventory' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  releaseGroupHold(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.releaseHold(propertyId, groupHoldId);
  }

  @Post('operations/group-holds/:groupHoldId/cancel')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Cancel group hold' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  cancelGroupHold(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.cancelHold(propertyId, groupHoldId);
  }

  @Post('operations/group-holds/:groupHoldId/confirm')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Confirm a group hold after deposit or approval' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  confirmGroupHold(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.confirmHold(propertyId, groupHoldId);
  }

  @Get('operations/group-holds/:groupHoldId/check-in-preview')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Preview group check-in readiness' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupCheckInPreviewDto)
  getGroupCheckInPreview(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
  ): Promise<GroupCheckInPreviewDto> {
    return this.groupBookingService.getCheckInPreview(propertyId, groupHoldId);
  }

  @Post('operations/group-holds/:groupHoldId/check-in')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Check in a confirmed group hold with one master folio' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupCheckInResultDto)
  checkInGroup(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
  ): Promise<GroupCheckInResultDto> {
    return this.groupBookingService.checkInGroup(propertyId, groupHoldId);
  }

  @Post('operations/group-holds/walk-in')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({
    summary: 'Create and check-in a walk-in group in one transaction',
    description:
      'One-click walk-in group flow: creates a group booking, room-type inventory blocks, physical room assignments, group stay, and a single master folio. Rooms are marked OCCUPIED immediately. Bypasses the hold → confirm → assign lifecycle since the guests are already at the front desk.',
  })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiStandardOkResponse(GroupCheckInResultDto)
  @ApiBadRequestResponse({
    description:
      'Invalid request: rooms not ready, conflicts, or bad payload. Stable code: VALIDATION_ERROR.',
  })
  @ApiNotFoundResponse({ description: 'Property not found. Stable code: NOT_FOUND.' })
  createWalkInGroup(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateWalkInGroupDto,
  ): Promise<GroupCheckInResultDto> {
    return this.groupBookingService.createWalkInGroup(propertyId, dto);
  }

  @Get('operations/in-house-groups')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'List checked-in groups currently in house' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiStandardListResponse(InHouseGroupDto)
  getInHouseGroups(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<InHouseGroupDto[]> {
    return this.groupBookingService.listInHouseGroups(propertyId);
  }

  @Get('operations/group-bookings/:groupBookingId/master-folio')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Get a checked-in group master folio detail' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupBookingId', format: 'uuid' })
  @ApiStandardOkResponse(GroupMasterFolioDetailDto)
  getGroupMasterFolio(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupBookingId', ParseUUIDPipe) groupBookingId: string,
  ): Promise<GroupMasterFolioDetailDto> {
    return this.groupBookingService.getGroupMasterFolioDetail(propertyId, groupBookingId);
  }

  @Post('operations/group-bookings/:groupBookingId/master-folio/charges')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Post a charge to a group master folio' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupBookingId', format: 'uuid' })
  @ApiStandardOkResponse(GroupMasterFolioDetailDto)
  postGroupMasterFolioCharge(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupBookingId', ParseUUIDPipe) groupBookingId: string,
    @Body() dto: PostGroupMasterFolioChargeDto,
  ): Promise<GroupMasterFolioDetailDto> {
    return this.groupBookingService.postGroupMasterFolioCharge(propertyId, groupBookingId, dto);
  }

  @Post('operations/group-bookings/:groupBookingId/master-folio/payments')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Record a payment against a group master folio' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupBookingId', format: 'uuid' })
  @ApiStandardOkResponse(GroupMasterFolioDetailDto)
  postGroupMasterFolioPayment(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupBookingId', ParseUUIDPipe) groupBookingId: string,
    @Body() dto: PostGroupMasterFolioPaymentDto,
  ): Promise<GroupMasterFolioDetailDto> {
    return this.groupBookingService.postGroupMasterFolioPayment(propertyId, groupBookingId, dto);
  }

  @Post('operations/group-bookings/:groupBookingId/master-folio/checkout')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Complete checkout for a settled group master folio' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupBookingId', format: 'uuid' })
  @ApiStandardOkResponse(GroupMasterFolioDetailDto)
  completeGroupCheckout(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupBookingId', ParseUUIDPipe) groupBookingId: string,
  ): Promise<GroupMasterFolioDetailDto> {
    return this.groupBookingService.completeGroupCheckout(propertyId, groupBookingId);
  }

  @Post('operations/group-holds/:groupHoldId/rooming-list')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Add a group rooming-list item' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  addGroupRoomingListItem(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
    @Body() dto: AddGroupRoomingListItemDto,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.addRoomingListItem(propertyId, groupHoldId, dto);
  }

  @Post('operations/group-holds/:groupHoldId/room-assignments')
  @RequirePermissions(Permissions.OperationsView, Permissions.RoomsView)
  @ApiOperation({ summary: 'Assign an actual room to a group hold' })
  @ApiParam({ name: 'propertyId', format: 'uuid' })
  @ApiParam({ name: 'groupHoldId', format: 'uuid' })
  @ApiStandardOkResponse(GroupHoldDto)
  assignGroupRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('groupHoldId', ParseUUIDPipe) groupHoldId: string,
    @Body() dto: AssignGroupRoomDto,
  ): Promise<GroupHoldDto> {
    return this.groupBookingService.assignRoom(propertyId, groupHoldId, dto);
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
