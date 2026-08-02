import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { BillingService } from './billing.service';
import { BillingMapper } from './billing.mapper';
import { RazorpayService } from './razorpay.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { CreateFolioPaymentDto } from './dto/create-folio-payment.dto';
import { FolioResponseDto } from './dto/folio-response.dto';
import { FolioStatus } from './domain/folio-status.enum';
import { FolioPaymentMethod } from './domain/folio-payment-method.enum';

type AuthRequest = Request & { user?: { id?: string } };

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly razorpayService: RazorpayService,
    private readonly receiptPdfService: ReceiptPdfService,
  ) {}

  @Get('folios')
  @RequirePermissions(Permissions.BillingView)
  @ApiStandardListResponse(FolioResponseDto)
  async list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('status') status?: FolioStatus,
  ): Promise<FolioResponseDto[]> {
    const folios = await this.billingService.listFolios(propertyId, status);
    return folios.map((folio) => BillingMapper.toResponse(folio));
  }

  @Get('billing/overview')
  @RequirePermissions(Permissions.BillingView)
  overview(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.billingService.getOverviewSummary(propertyId);
  }

  @Get('folios/:folioId')
  @RequirePermissions(Permissions.BillingView)
  @ApiStandardOkResponse(FolioResponseDto)
  async findOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
  ): Promise<FolioResponseDto> {
    const folio = await this.billingService.getFolio(propertyId, folioId);
    return BillingMapper.toResponse(folio);
  }

  @Get('reservations/:reservationId/folio')
  @RequirePermissions(Permissions.BillingView)
  @ApiStandardOkResponse(FolioResponseDto)
  async folioForReservation(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
  ): Promise<FolioResponseDto> {
    const folio = await this.billingService.getOrCreateFolioForReservation(
      propertyId,
      reservationId,
    );
    return BillingMapper.toResponse(folio);
  }

  @Post('folios/:folioId/charges')
  @RequirePermissions(Permissions.BillingManage)
  @ApiStandardOkResponse(FolioResponseDto)
  async addCharge(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
    @Body() dto: CreateFolioChargeDto,
    @Req() req: AuthRequest,
  ): Promise<FolioResponseDto> {
    const folio = await this.billingService.addCharge(
      propertyId,
      folioId,
      dto,
      req.user?.id ?? null,
    );
    return BillingMapper.toResponse(folio);
  }

  @Post('folios/:folioId/payments')
  @RequirePermissions(Permissions.BillingManage)
  @ApiStandardOkResponse(FolioResponseDto)
  async addPayment(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
    @Body() dto: CreateFolioPaymentDto,
    @Req() req: AuthRequest,
  ): Promise<FolioResponseDto> {
    const folio = await this.billingService.addPayment(
      propertyId,
      folioId,
      dto,
      req.user?.id ?? null,
    );
    return BillingMapper.toResponse(folio);
  }

  @Post('folios/:folioId/settle')
  @RequirePermissions(Permissions.BillingManage)
  @ApiStandardOkResponse(FolioResponseDto)
  async settle(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
  ): Promise<FolioResponseDto> {
    const folio = await this.billingService.settleFolio(propertyId, folioId);
    return BillingMapper.toResponse(folio);
  }

  @Get('folios/:folioId/final-bill.pdf')
  @RequirePermissions(Permissions.BillingView)
  @RawResponse()
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async downloadFinalBill(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
    @Res() res: Response,
  ): Promise<void> {
    const folio = await this.billingService.getFolio(propertyId, folioId);
    let buffer: Buffer;
    try {
      const response = BillingMapper.toResponse(folio);
      const guest = folio.guest;
      const reservation = folio.reservation;
      const property = folio.property;
      buffer = await this.receiptPdfService.generateFinalBill({
        folio,
        totals: {
          total: response.totals.total,
          paid: response.totals.paid,
          balance: response.totals.balance,
        },
        charges: folio.charges ?? [],
        payments: folio.payments ?? [],
        property: {
          name: property?.name ?? property?.legalName ?? 'Hotel',
          legalName: property?.legalName ?? null,
          gstNumber: property?.gstNumber ?? null,
          phone: property?.phone ?? null,
          email: property?.email ?? null,
          address: [
            property?.addressLine1,
            property?.addressLine2,
            property?.city,
            property?.state,
            property?.postalCode,
            property?.country,
          ].filter(Boolean).join(', '),
        },
        guestName: guest?.displayName ?? [guest?.firstName, guest?.lastName].filter(Boolean).join(' ') ?? 'Guest',
        reservationCode: reservation?.reservationCode ?? '-',
        roomNumber: reservation?.room?.roomNumber ?? undefined,
        stay: reservation ? { arrival: reservation.arrivalDate, departure: reservation.departureDate } : undefined,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[final-bill.pdf]', err instanceof Error ? err.stack : err);
      res.status(500).json({ success: false, error: { code: 'PDF_GENERATION_FAILED', message: err instanceof Error ? err.message : 'Unknown' } });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="final-bill-${folio.folioNumber}.pdf"`);
    res.send(buffer);
  }

  @Get('folios/:folioId/payments/:paymentId/receipt.pdf')
  @RequirePermissions(Permissions.BillingManage)
  @RawResponse()
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async downloadReceipt(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const folio = await this.billingService.getFolio(propertyId, folioId);
    const payment = (folio.payments ?? []).find((p) => p.id === paymentId);
    if (!payment) {
      res.status(404).json({ success: false, error: { code: 'PAYMENT_NOT_FOUND' } });
      return;
    }
    let buffer: Buffer;
    try {
      const response = BillingMapper.toResponse(folio);
      const guest = folio.guest;
      const reservation = folio.reservation;
      const property = folio.property;
      buffer = await this.receiptPdfService.generate({
        folio,
        totals: {
          total: response.totals.total,
          paid: response.totals.paid,
          balance: response.totals.balance,
        },
        charges: folio.charges ?? [],
        payments: folio.payments ?? [],
        payment,
        property: {
          name: property?.name ?? property?.legalName ?? 'Hotel',
          legalName: property?.legalName ?? null,
          gstNumber: property?.gstNumber ?? null,
          phone: property?.phone ?? null,
          email: property?.email ?? null,
          address: [
            property?.addressLine1,
            property?.addressLine2,
            property?.city,
            property?.state,
            property?.postalCode,
            property?.country,
          ].filter(Boolean).join(', '),
        },
        guestName: guest?.displayName ?? [guest?.firstName, guest?.lastName].filter(Boolean).join(' ') ?? 'Guest',
        reservationCode: reservation?.reservationCode ?? '-',
        roomNumber: reservation?.room?.roomNumber ?? undefined,
        stay: reservation ? { arrival: reservation.arrivalDate, departure: reservation.departureDate } : undefined,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[receipt.pdf]', err instanceof Error ? err.stack : err);
      res.status(500).json({ success: false, error: { code: 'PDF_GENERATION_FAILED', message: err instanceof Error ? err.message : 'Unknown' } });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.id.slice(0, 8)}.pdf"`);
    res.send(buffer);
  }

  @Get('folios/:folioId/razorpay/config')
  @RequirePermissions(Permissions.BillingManage)
  razorpayConfig() {
    return { configured: this.razorpayService.isConfigured() };
  }

  @Post('folios/:folioId/razorpay/order')
  @RequirePermissions(Permissions.BillingManage)
  async createRazorpayOrder(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
    @Body() dto: { amount: string; reservationId?: string; guestName?: string },
  ) {
    // Validate folio exists + belongs to property (uses existing service which throws NotFound).
    await this.billingService.getFolio(propertyId, folioId);
    return this.razorpayService.createOrder({
      amount: dto.amount,
      folioId,
      reservationId: dto.reservationId,
      guestName: dto.guestName,
    });
  }

  @Post('folios/:folioId/razorpay/verify')
  @RequirePermissions(Permissions.BillingManage)
  @ApiStandardOkResponse(FolioResponseDto)
  async verifyRazorpayPayment(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('folioId', new ParseUUIDPipe()) folioId: string,
    @Body() dto: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      amount: string;
    },
    @Req() req: AuthRequest,
  ): Promise<FolioResponseDto> {
    this.razorpayService.verifySignature({
      razorpay_order_id: dto.razorpay_order_id,
      razorpay_payment_id: dto.razorpay_payment_id,
      razorpay_signature: dto.razorpay_signature,
    });
    // Record the payment against the folio via the existing service.
    const folio = await this.billingService.addPayment(
      propertyId,
      folioId,
      {
        amount: dto.amount,
        method: FolioPaymentMethod.CARD,
        reference: dto.razorpay_payment_id,
        notes: `Razorpay order ${dto.razorpay_order_id}`,
      } as CreateFolioPaymentDto,
      req.user?.id ?? null,
    );
    return BillingMapper.toResponse(folio);
  }
}
