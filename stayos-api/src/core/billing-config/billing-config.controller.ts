import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { BillingConfigService } from './billing-config.service';
import { UpsertPropertyBillingConfigDto } from './dto/upsert-property-billing-config.dto';

@ApiTags('Billing Config')
@ApiBearerAuth()
@Controller('properties/:propertyId/billing-config')
export class BillingConfigController {
  constructor(private readonly billingConfigService: BillingConfigService) {}

  @Get()
  @RequirePermissions(Permissions.SettingsView, Permissions.BillingView)
  @ApiOperation({ summary: 'Get property billing/invoice configuration' })
  @ApiBadRequestResponse({ description: 'Invalid property id' })
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.billingConfigService.get(propertyId);
  }

  @Put()
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create or update property billing/invoice configuration' })
  @ApiBadRequestResponse({ description: 'Invalid property id or payload' })
  upsert(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpsertPropertyBillingConfigDto,
  ) {
    return this.billingConfigService.upsert(propertyId, dto);
  }
}
