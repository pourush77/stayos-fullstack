import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardListResponse, ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import {
  AddGuestRequestNoteDto,
  CreateGuestRequestDto,
  GuestRequestQueryDto,
  GuestRequestResponseDto,
  GuestRequestSummaryDto,
  UpdateGuestRequestDto,
} from './dto/guest-request.dto';
import { GuestRequestsService } from './guest-requests.service';

@ApiTags('Guest Requests')
@ApiBearerAuth()
@Controller('properties/:propertyId/guest-requests')
export class GuestRequestsController {
  constructor(private readonly guestRequestsService: GuestRequestsService) {}

  @Get()
  @RequirePermissions(Permissions.GuestRequestsView)
  @ApiOperation({ summary: 'List guest requests' })
  @ApiStandardListResponse(GuestRequestResponseDto)
  findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: GuestRequestQueryDto,
  ) {
    return this.guestRequestsService.findAll(propertyId, query);
  }

  @Get('summary')
  @RequirePermissions(Permissions.GuestRequestsView)
  @ApiOperation({ summary: 'Get guest request summary' })
  @ApiStandardOkResponse(GuestRequestSummaryDto)
  getSummary(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.guestRequestsService.getSummary(propertyId);
  }

  @Get('suggestions')
  @RequirePermissions(Permissions.GuestRequestsView)
  @ApiOperation({ summary: 'Get request suggestions with server-owned assignment' })
  getSuggestions() {
    return this.guestRequestsService.getSuggestions();
  }

  @Get(':requestId')
  @RequirePermissions(Permissions.GuestRequestsView)
  @ApiOperation({ summary: 'Get guest request by id' })
  @ApiStandardOkResponse(GuestRequestResponseDto)
  findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.guestRequestsService.findOne(propertyId, requestId);
  }

  @Post()
  @RequirePermissions(Permissions.GuestRequestsManage)
  @ApiOperation({ summary: 'Create guest request' })
  @ApiStandardOkResponse(GuestRequestResponseDto)
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateGuestRequestDto,
  ) {
    return this.guestRequestsService.create(propertyId, dto);
  }

  @Patch(':requestId')
  @RequirePermissions(Permissions.GuestRequestsManage)
  @ApiOperation({ summary: 'Update guest request' })
  @ApiStandardOkResponse(GuestRequestResponseDto)
  update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateGuestRequestDto,
  ) {
    return this.guestRequestsService.update(propertyId, requestId, dto);
  }

  @Patch(':requestId/accept')
  @RequirePermissions(Permissions.GuestRequestsManage)
  accept(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.guestRequestsService.transition(propertyId, requestId, 'accept');
  }

  @Patch(':requestId/start')
  @RequirePermissions(Permissions.GuestRequestsManage)
  start(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.guestRequestsService.transition(propertyId, requestId, 'start');
  }

  @Patch(':requestId/complete')
  @RequirePermissions(Permissions.GuestRequestsManage)
  complete(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.guestRequestsService.transition(propertyId, requestId, 'complete');
  }

  @Patch(':requestId/cancel')
  @RequirePermissions(Permissions.GuestRequestsManage)
  cancel(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.guestRequestsService.transition(propertyId, requestId, 'cancel');
  }

  @Post(':requestId/note')
  @RequirePermissions(Permissions.GuestRequestsManage)
  addNote(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: AddGuestRequestNoteDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ) {
    return this.guestRequestsService.addNote(propertyId, requestId, dto, user?.id ?? null);
  }
}
