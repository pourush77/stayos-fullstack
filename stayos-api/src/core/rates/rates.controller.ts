import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { UpsertGuestPricingPolicyDto } from './dto/upsert-guest-pricing-policy.dto';
import { UpsertPropertyTaxConfigDto } from './dto/upsert-property-tax-config.dto';
import {
  CreateDailyRateDto,
  CreateRatePlanDto,
  UpdateRatePlanDto,
  UpsertRatePlanRoomTypeDto,
} from './dto/rate-plan.dto';
import { RatesService } from './rates.service';
import { RestrictionService } from './restriction.service';
import { ListRestrictionsQueryDto, UpsertRestrictionsDto } from './dto/restriction.dto';
import { Query } from '@nestjs/common';
import { TaxService } from './tax.service';

@ApiTags('Rates')
@ApiBearerAuth()
@Controller('properties/:propertyId/rates')
export class RatesController {
  constructor(
    private readonly ratesService: RatesService,
    private readonly taxService: TaxService,
    private readonly restrictionService: RestrictionService,
  ) {}

  @Get('rate-plans')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'List rate plans for a property' })
  listRatePlans(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.ratesService.findRatePlans(propertyId);
  }

  @Post('rate-plans')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create a rate plan' })
  createRatePlan(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateRatePlanDto,
  ) {
    return this.ratesService.createRatePlan(propertyId, dto);
  }

  @Get('rate-plans/:ratePlanId')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'Get a rate plan' })
  getRatePlan(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
  ) {
    return this.ratesService.findRatePlan(propertyId, ratePlanId);
  }

  @Patch('rate-plans/:ratePlanId')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Update a rate plan (status change deactivates it)' })
  updateRatePlan(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
    @Body() dto: UpdateRatePlanDto,
  ) {
    return this.ratesService.updateRatePlan(propertyId, ratePlanId, dto);
  }

  @Get('rate-plans/:ratePlanId/room-types')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'List a rate plan\'s applicable room types + base pricing' })
  listRatePlanRoomTypes(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
  ) {
    return this.ratesService.findRatePlanRoomTypes(propertyId, ratePlanId);
  }

  @Put('rate-plans/:ratePlanId/room-types')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create or update base pricing for a (rate plan, room type)' })
  upsertRatePlanRoomType(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
    @Body() dto: UpsertRatePlanRoomTypeDto,
  ) {
    return this.ratesService.upsertRatePlanRoomType(propertyId, ratePlanId, dto);
  }

  @Delete('rate-plans/:ratePlanId/room-types/:roomTypeId')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Remove a room type from a rate plan' })
  removeRatePlanRoomType(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
  ) {
    return this.ratesService.removeRatePlanRoomType(propertyId, ratePlanId, roomTypeId);
  }

  @Get('rate-plans/:ratePlanId/daily-rates')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'List date-wise rate overrides for a rate plan' })
  listDailyRates(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
  ) {
    return this.ratesService.findDailyRates(propertyId, ratePlanId);
  }

  @Post('rate-plans/:ratePlanId/daily-rates')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create a date-wise rate override' })
  createDailyRate(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ratePlanId', ParseUUIDPipe) ratePlanId: string,
    @Body() dto: CreateDailyRateDto,
  ) {
    return this.ratesService.createDailyRate(propertyId, { ...dto, ratePlanId });
  }

  @Delete('daily-rates/:id')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Delete a date-wise rate override' })
  removeDailyRate(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ratesService.removeDailyRate(propertyId, id);
  }

  @Get('guest-pricing-policy')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({
    summary: 'Get property guest and child pricing policy',
  })
  @ApiBadRequestResponse({
    description: 'Invalid property id',
  })
  getGuestPricingPolicy(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.ratesService.getGuestPricingPolicy(propertyId);
  }

  @Put('guest-pricing-policy')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({
    summary: 'Create or update property guest and child pricing policy',
  })
  @ApiBadRequestResponse({
    description: 'Invalid property id or guest pricing policy',
  })
  upsertGuestPricingPolicy(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpsertGuestPricingPolicyDto,
  ) {
    return this.ratesService.upsertGuestPricingPolicy(propertyId, dto);
  }

  @Get('taxes')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({
    summary: 'Get property tax configuration',
  })
  getPropertyTaxConfig(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.taxService.getPropertyTaxConfig(propertyId);
  }

  @Put('taxes')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({
    summary: 'Create or update property tax configuration',
  })
  upsertPropertyTaxConfig(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpsertPropertyTaxConfigDto,
  ) {
    return this.taxService.upsertPropertyTaxConfig(propertyId, dto);
  }

  @Get('restrictions')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'List sale restrictions (stopSell/CTA/CTD/minStay/maxStay)' })
  listRestrictions(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: ListRestrictionsQueryDto,
  ) {
    return this.restrictionService.listRestrictions(propertyId, query);
  }

  @Put('restrictions')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Bulk upsert sale restrictions across a date range' })
  upsertRestrictions(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpsertRestrictionsDto,
  ) {
    return this.restrictionService.upsertRestrictions(propertyId, dto);
  }

  @Delete('restrictions/:id')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Delete a sale restriction row' })
  removeRestriction(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.restrictionService.deleteRestriction(propertyId, id);
  }
}
