import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { InvoiceService } from './invoice.service';
import { FinalizeInvoiceDto, IssueCreditNoteDto, VoidInvoiceDto } from './dto/invoice.dto';

type AuthRequest = Request & { user?: { id?: string } };

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('folios/:folioId/invoice/preview')
  @RequirePermissions(Permissions.BillingView)
  @ApiOperation({ summary: 'Read-only draft invoice built from the current frozen folio state' })
  preview(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('folioId', ParseUUIDPipe) folioId: string,
  ) {
    return this.invoiceService.previewInvoice(propertyId, folioId);
  }

  @Get('folios/:folioId/invoices')
  @RequirePermissions(Permissions.BillingView)
  @ApiOperation({ summary: 'List invoices and credit notes for a folio' })
  listForFolio(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('folioId', ParseUUIDPipe) folioId: string,
  ) {
    return this.invoiceService.listForFolio(propertyId, folioId);
  }

  @Post('folios/:folioId/invoice/finalize')
  @RequirePermissions(Permissions.BillingManage)
  @ApiOperation({ summary: 'Finalize the immutable tax invoice (idempotent, zero-balance required)' })
  finalize(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('folioId', ParseUUIDPipe) folioId: string,
    @Body() dto: FinalizeInvoiceDto,
    @Req() req: AuthRequest,
  ) {
    return this.invoiceService.finalizeInvoice(propertyId, folioId, dto.idempotencyKey ?? null, req.user?.id ?? null);
  }

  @Get('invoices/:invoiceId')
  @RequirePermissions(Permissions.BillingView)
  @ApiOperation({ summary: 'Get an invoice / credit note by id' })
  get(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.invoiceService.getInvoice(propertyId, invoiceId);
  }

  @Post('invoices/:invoiceId/credit-note')
  @RequirePermissions(Permissions.BillingManage)
  @ApiOperation({ summary: 'Issue an auditable credit note against a finalized invoice' })
  creditNote(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: IssueCreditNoteDto,
    @Req() req: AuthRequest,
  ) {
    return this.invoiceService.issueCreditNote(propertyId, invoiceId, dto.reason, req.user?.id ?? null);
  }

  @Post('invoices/:invoiceId/void')
  @RequirePermissions(Permissions.BillingManage)
  @ApiOperation({ summary: 'Void a DRAFT invoice (finalized invoices are immutable — use a credit note)' })
  void(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.invoiceService.voidDraftInvoice(propertyId, invoiceId, dto.reason);
  }
}
