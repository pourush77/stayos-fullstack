import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { PropertyPolicyType } from './domain/property-policy-type.enum';
import { UpsertPropertyPolicyDto } from './dto/upsert-property-policy.dto';
import { PoliciesMapper } from './policies.mapper';
import { PoliciesService } from './policies.service';

@ApiTags('Policies')
@ApiBearerAuth()
@Controller('properties/:propertyId/policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'List property policies' })
  @ApiBadRequestResponse({ description: 'Invalid property id' })
  async list(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    const policies = await this.policiesService.list(propertyId);
    return policies.map(PoliciesMapper.toResponse);
  }

  @Get(':policyType')
  @RequirePermissions(Permissions.SettingsView, Permissions.BookingsView)
  @ApiOperation({ summary: 'Get a single property policy' })
  @ApiBadRequestResponse({ description: 'Invalid property id or policy type' })
  async getOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('policyType', new ParseEnumPipe(PropertyPolicyType)) policyType: PropertyPolicyType,
    @Query('ratePlanId', new ParseUUIDPipe({ optional: true })) ratePlanId?: string,
  ) {
    const policy = await this.policiesService.getOne(propertyId, policyType, ratePlanId ?? null);
    return policy ? PoliciesMapper.toResponse(policy) : null;
  }

  @Put(':policyType')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create or update a property policy' })
  @ApiBadRequestResponse({ description: 'Invalid property id, policy type or payload' })
  async upsert(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('policyType', new ParseEnumPipe(PropertyPolicyType)) policyType: PropertyPolicyType,
    @Body() dto: UpsertPropertyPolicyDto,
  ) {
    const policy = await this.policiesService.upsert(propertyId, policyType, dto);
    return PoliciesMapper.toResponse(policy);
  }
}
