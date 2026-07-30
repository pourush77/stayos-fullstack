import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { BillingService } from './billing.service';
import { BillingMapper } from './billing.mapper';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { CreateFolioPaymentDto } from './dto/create-folio-payment.dto';
import { FolioResponseDto } from './dto/folio-response.dto';
import { FolioStatus } from './domain/folio-status.enum';

type AuthRequest = Request & { user?: { id?: string } };

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
}
