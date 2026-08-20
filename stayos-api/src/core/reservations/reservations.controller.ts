import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { QuoteReservationDto } from './dto/quote-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { AssignRoomDto } from './dto/assign-room.dto';
import { CheckInWorkspaceResponseDto } from './dto/check-in-workspace-response.dto';
import { ExtendReservationDto } from './dto/extend-reservation.dto';
import { MoveRoomDto } from './dto/move-room.dto';
import { PaymentReviewDto } from './dto/payment-review.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import {
  CheckInActionDto,
  CheckOutActionDto,
  LifecycleActionDto,
} from './dto/lifecycle-action.dto';
import { ReservationWorkflowResponseDto } from './dto/reservation-workflow-response.dto';
import { UpdateGuestRegistrationDto } from './dto/update-guest-registration.dto';
import { UpdateIdentityVerificationDto } from './dto/update-identity-verification.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsMapper } from './reservations.mapper';
import { ReservationsService } from './reservations.service';
import { ReservationQuoteService } from './services/reservation-quote.service';
import { CheckInService } from './services/check-in.service';
import { ReservationWorkflowService } from './services/reservation-workflow.service';
import { BookingConfirmationEmailService } from '../notifications/email/booking-confirmation-email.service';
import { CheckoutInvoiceEmailService } from '../notifications/email/checkout-invoice-email.service';

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
    private readonly reservationQuoteService: ReservationQuoteService,
    private readonly bookingConfirmationEmailService: BookingConfirmationEmailService,
    private readonly checkoutInvoiceEmailService: CheckoutInvoiceEmailService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.BookingsView)
  @ApiOperation({ summary: 'List reservations for a property' })
  @ApiStandardListResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or query' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListReservationsQueryDto,
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

  @Post('quote')
  @HttpCode(200)
  @RequirePermissions(Permissions.BookingsView)
  @ApiOperation({
    summary: 'Price a reservation (read-only quote)',
    description:
      'Runs the same pricing path a create would persist: resolves the effective/default rate plan, prices via the rate resolver, applies GST via the tax-rules engine and resolves the INDIVIDUAL_DEPOSIT policy. Enforces room-type occupancy. Performs no writes.',
  })
  @ApiBadRequestResponse({ description: 'Invalid quote payload, dates or occupancy' })
  @ApiNotFoundResponse({ description: 'Property or room type not found' })
  async quote(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() quoteReservationDto: QuoteReservationDto,
  ) {
    return this.reservationQuoteService.quote(propertyId, quoteReservationDto);
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

    // Communication is best-effort and never changes reservation success.
    // queueAutomatic exits immediately when email is disabled, missing, or the
    // reservation was created as PENDING.
    try {
      await this.bookingConfirmationEmailService.queueAutomatic(propertyId, reservation.id);
    } catch {
      // Booking is authoritative. Notification infrastructure must never make
      // a successfully committed reservation appear to fail to front desk.
    }

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

  @Patch(':reservationId/move-room')
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Move a checked-in reservation to another room' })
  @ApiStandardOkResponse(ReservationWorkflowResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid move state or unavailable target room' })
  @ApiNotFoundResponse({ description: 'Reservation or room not found' })
  async moveRoom(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: MoveRoomDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.moveRoom(propertyId, reservationId, dto, {
      actorId: user?.id ?? null,
    });
  }

  @Patch(':reservationId/confirm')
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Confirm a reservation (freezes policy/tax snapshot)' })
  @ApiStandardOkResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid state transition' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  async confirm(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationWorkflowService.confirm(propertyId, reservationId, {
      actorId: user?.id ?? null,
    });

    try {
      await this.bookingConfirmationEmailService.queueAutomatic(propertyId, reservation.id);
    } catch {
      // Confirmation is authoritative. Email failure must never roll it back
      // or surface as a failed reservation operation.
    }

    return ReservationsMapper.toResponse(reservation);
  }

  @Post(':reservationId/send-confirmation-email')
  @HttpCode(200)
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Send the booking confirmation email again' })
  @ApiBadRequestResponse({ description: 'Reservation is not confirmed or guest has no email' })
  @ApiNotFoundResponse({ description: 'Reservation or property not found' })
  async resendConfirmationEmail(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ): Promise<{ success: true; queued: boolean; message: string }> {
    const result = await this.bookingConfirmationEmailService.resend(propertyId, reservationId);

    const message =
      result.reason === 'NO_GUEST_EMAIL'
        ? 'Guest email is not available.'
        : result.reason === 'EMAIL_DISABLED'
          ? 'Email service is not configured.'
          : result.reason === 'NOT_CONFIRMED'
            ? 'Only confirmed bookings can send a confirmation email.'
            : 'Booking confirmation email queued.';

    return {
      success: true,
      queued: result.queued,
      message,
    };
  }

  @Patch(':reservationId/cancel')
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiStandardOkResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid state transition' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  async cancel(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationWorkflowService.cancel(
      propertyId,
      reservationId,
      dto.reason ?? null,
      { actorId: user?.id ?? null },
    );
    return ReservationsMapper.toResponse(reservation);
  }

  @Patch(':reservationId/no-show')
  @RequirePermissions(Permissions.BookingsManage)
  @ApiOperation({ summary: 'Mark a reservation as no-show' })
  @ApiStandardOkResponse(ReservationResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid state transition' })
  @ApiNotFoundResponse({ description: 'Reservation not found' })
  async noShow(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationResponseDto> {
    const reservation = await this.reservationWorkflowService.markNoShow(
      propertyId,
      reservationId,
      dto.reason ?? null,
      { actorId: user?.id ?? null },
    );
    return ReservationsMapper.toResponse(reservation);
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
    @Body() dto: CheckInActionDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    return this.reservationWorkflowService.checkIn(
      propertyId,
      reservationId,
      { actorId: user?.id ?? null },
      { earlyCheckIn: dto?.earlyCheckIn ?? false },
    );
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
    @Body() dto: CheckOutActionDto,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<ReservationWorkflowResponseDto> {
    const result = await this.reservationWorkflowService.checkOut(
      propertyId,
      reservationId,
      { actorId: user?.id ?? null },
      { lateCheckout: dto?.lateCheckout ?? false },
    );

    try {
      await this.checkoutInvoiceEmailService.queueAutomatic(propertyId, reservationId);
    } catch {
      // Checkout is authoritative. Notification infrastructure must never make
      // a successfully committed checkout appear to fail to front desk.
    }

    return result;
  }

  @Post(':reservationId/send-final-invoice-email')
  @HttpCode(200)
  @RequirePermissions(Permissions.CheckoutManage)
  @ApiOperation({ summary: 'Send the finalized tax invoice email again' })
  @ApiBadRequestResponse({
    description:
      'Reservation is not checked out, guest has no email, or finalized tax invoice is unavailable',
  })
  @ApiNotFoundResponse({ description: 'Reservation or property not found' })
  async resendFinalInvoiceEmail(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ): Promise<{ success: true; queued: boolean; message: string }> {
    const result = await this.checkoutInvoiceEmailService.resend(propertyId, reservationId);

    const message =
      result.reason === 'NO_GUEST_EMAIL'
        ? 'Guest email is not available.'
        : result.reason === 'EMAIL_DISABLED'
          ? 'Email service is not configured.'
          : result.reason === 'PROPERTY_EMAIL_DISABLED'
            ? 'Guest email notifications are disabled for this property.'
            : result.reason === 'NOT_CHECKED_OUT'
              ? 'Final invoice email can be sent only after checkout.'
              : result.reason === 'NO_FINALIZED_INVOICE'
                ? 'A finalized tax invoice is not available yet.'
                : 'Final invoice email queued.';

    return {
      success: true,
      queued: result.queued,
      message,
    };
  }
}
