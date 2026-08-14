import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { UpsertGuestPricingPolicyDto } from './dto/upsert-guest-pricing-policy.dto';
import { UpsertPropertyTaxConfigDto } from './dto/upsert-property-tax-config.dto';
import { RatesService } from './rates.service';
import { TaxService } from './tax.service';

@ApiTags('Rates')
@ApiBearerAuth()
@Controller('properties/:propertyId/rates')
export class RatesController {
  constructor(
    private readonly ratesService: RatesService,
    private readonly taxService: TaxService,
  ) {}

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
}
