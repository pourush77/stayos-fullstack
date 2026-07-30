import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { PreWrappedSuccessResponse } from '../../common/dto/api-success-response.dto';
import { PaginationMeta, PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  ApiStandardCreatedResponse,
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { AssignRoomDto } from './dto/assign-room.dto';
import { CheckInWorkspaceResponseDto } from './dto/check-in-workspace-response.dto';
import { ExtendReservationDto } from './dto/extend-reservation.dto';
import { PaymentReviewDto } from './dto/payment-review.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { ReservationWorkflowResponseDto } from './dto/reservation-workflow-response.dto';
import { UpdateGuestRegistrationDto } from './dto/update-guest-registration.dto';
import { UpdateIdentityVerificationDto } from './dto/update-identity-verification.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsMapper } from './reservations.mapper';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './services/check-in.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';

type ReservationListResponse = PreWrappedSuccessResponse<ReservationResponseDto[]> & {
  message: string;
  pagination?: PaginationMeta;
};

@ApiTags('Reservations')
@ApiBearerAuth()
@Controller('properties/:propertyId/reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly reservationWorkflowService: ReservationWorkflowService,
    private readonly checkInService: CheckInService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.BookingsView)
  @ApiOperation({ summary: 'List reservations for a property' })
  @ApiStandardListResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or query' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ReservationListResponse> {
    const result = await this.reservationsService.findAll(propertyId, query);

    return {
      success: true,
      message: 'Records fetched successfully.',
      data: result.data.map(ReservationsMapper.toResponse),
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  @Get(':id')
  @RequirePermissions(Permissions.BookingsView)
  @ApiOperation({ summary: 'Get reservation by id' })
  @ApiStandardOkResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or reservation id' })
  @ApiNotFoundResponse({ description: 'Property or reservation not found' })
  async findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationsService.findOne(propertyId, id);

    return ReservationsMapper.toResponse(reservation);
  }

  @Post()
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Create reservation' })
  @ApiStandardCreatedResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid reservation payload or cross-property reference' })
  @ApiNotFoundResponse({ description: 'Property, guest, room type, or room not found' })
  @ApiConflictResponse({ description: 'Reservation code already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() createReservationDto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationsService.create(propertyId, createReservationDto);

    return ReservationsMapper.toResponse(reservation);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Update reservation' })
  @ApiStandardOkResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid reservation payload or cross-property reference' })
  @ApiNotFoundResponse({
    description: 'Property, reservation, guest, room type, or room not found',
  })
  @ApiConflictResponse({ description: 'Reservation code already exists' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReservationDto: UpdateReservationDto,
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationsService.update(propertyId, id, updateReservationDto);

    return ReservationsMapper.toResponse(reservation);
  }

  @Patch(':reservationId/assign-room')
  @RequirePermissions(Permissions.ArrivalManage, Permissions.BookingsManage)
  @ApiOperation({ summary: 'Assign room to reservation' })
  @ApiStandardOkResponse(ReservationWorkflowResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid assignment or unavailable room' })
  @ApiNotFoundResponse({ description: 'Reservation or room not found' })
  async assignRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() assignRoomDto: AssignRoomDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.assignRoom(propertyId, reservationId, assignRoomDto, {
      actorId: user?.id ?? null,
    });
  }
  @Patch(':reservationId/unassign-room')
  @RequirePermissions(Permissions.ArrivalManage, Permissions.BookingsManage)
  @ApiOperation({ summary: 'Remove room assignment from reservation' })
  @ApiStandardOkResponse(ReservationWorkflowResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid unassignment state' })
  @ApiNotFoundResponse({ description: 'Reservation or assigned room not found' })
  async unassignRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.unassignRoom(propertyId, reservationId, {
      actorId: user?.id ?? null,
    });
  }

  @Patch(':reservationId/extend')
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Extend a checked-in reservation departure date' })
  @ApiStandardOkResponse(ReservationWorkflowResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid departure date or reservation state' })
  @ApiNotFoundResponse({ description: 'Reservation or room not found' })
  async extendStay(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: ExtendReservationDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.extendStay(propertyId, reservationId, dto, {
      actorId: user?.id ?? null,
    });
  }

  @Get(':reservationId/check-in-workspace')
  @RequirePermissions(Permissions.CheckinManage, Permissions.BookingsView)
  @ApiOperation({ summary: 'Get check-in workspace readiness for a reservation' })
  @ApiStandardOkResponse(CheckInWorkspaceResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid check-in workspace request' })
  @ApiNotFoundResponse({ description: 'Reservation, guest, or room not found' })
  async getCheckInWorkspace(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.checkInService.getWorkspace(propertyId, reservationId);
  }

  @Patch(':reservationId/check-in/guest-registration')
  @RequirePermissions(Permissions.CheckinManage)
  @ApiOperation({ summary: 'Update guest registration details for check-in' })
  @ApiStandardOkResponse(CheckInWorkspaceResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid guest registration payload' })
  @ApiNotFoundResponse({ description: 'Reservation or guest not found' })
  async updateGuestRegistration(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: UpdateGuestRegistrationDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.checkInService.updateGuestRegistration(propertyId, reservationId, dto, {
      actorId: user?.id ?? null,
    });
  }

  @Patch(':reservationId/check-in/identity')
  @RequirePermissions(Permissions.CheckinManage)
  @ApiOperation({ summary: 'Update identity verification for check-in' })
  @ApiStandardOkResponse(CheckInWorkspaceResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid identity verification payload' })
  @ApiNotFoundResponse({ description: 'Reservation or guest not found' })
  async updateIdentity(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: UpdateIdentityVerificationDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.checkInService.updateIdentity(propertyId, reservationId, dto, {
      actorId: user?.id ?? null,
    });
  }

  @Patch(':reservationId/check-in/payment-review')
  @RequirePermissions(Permissions.CheckinManage)
  @ApiOperation({ summary: 'Mark check-in payment review' })
  @ApiStandardOkResponse(CheckInWorkspaceResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid payment review payload' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  async reviewPayment(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: PaymentReviewDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<CheckInWorkspaceResponseDto> {
    return this.checkInService.reviewPayment(propertyId, reservationId, dto, {
      actorId: user?.id ?? null,
    });
  }

  @Patch(':reservationId/check-in')
  @RequirePermissions(Permissions.CheckinManage)
  @ApiOperation({ summary: 'Check in reservation' })
  @ApiStandardOkResponse(ReservationWorkflowResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid check-in state or room state' })
  @ApiNotFoundResponse({ description: 'Reservation, guest, or room not found' })
  async checkIn(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.checkIn(propertyId, reservationId, {
      actorId: user?.id ?? null,
    });
  }

  @Patch(':reservationId/check-out')
  @RequirePermissions(Permissions.CheckoutManage)
  @ApiOperation({ summary: 'Check out reservation' })
  @ApiStandardOkResponse(ReservationWorkflowResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid check-out state' })
  @ApiNotFoundResponse({ description: 'Reservation or room not found' })
  async checkOut(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.checkOut(propertyId, reservationId, {
      actorId: user?.id ?? null,
    });
  }
}
