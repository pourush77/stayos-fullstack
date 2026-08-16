import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import {
  ApiStandardCreatedResponse,
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { PreWrappedSuccessResponse } from '../../common/dto/api-success-response.dto';
import { PaginationMeta, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PolicyResolverService } from '../policies/policy-resolver.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyEntity } from './infrastructure/property.entity';
import { PropertiesMapper } from './properties.mapper';
import { PropertiesService } from './properties.service';

type PropertyListResponse = PreWrappedSuccessResponse<PropertyResponseDto[]> & {
  message: string;
  pagination?: PaginationMeta;
};

@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly policyResolver: PolicyResolverService,
  ) {}

  private async toResponse(property: PropertyEntity): Promise<PropertyResponseDto> {
    const deposit = await this.policyResolver.resolveGroupDepositInput(property.id);
    return PropertiesMapper.toResponse(property, {
      type: deposit.type,
      value: deposit.value ?? 0,
    });
  }

  @Get()
  @RequirePermissions(Permissions.SettingsView, Permissions.RoomsView, Permissions.OperationsView)
  @ApiOperation({ summary: 'List properties' })
  @ApiStandardListResponse(PropertyResponseDto)
  async findAll(@Query() query: PaginationQueryDto): Promise<PropertyListResponse> {
    const result = await this.propertiesService.findAll(query);
    const data = await Promise.all(result.data.map((property) => this.toResponse(property)));

    return {
      success: true,
      message: 'Records fetched successfully.',
      data,
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  @Get(':id')
  @RequirePermissions(Permissions.SettingsView, Permissions.RoomsView, Permissions.OperationsView)
  @ApiOperation({ summary: 'Get property by id' })
  @ApiStandardOkResponse(PropertyResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyResponseDto> {
    const property = await this.propertiesService.findOne(id);

    return this.toResponse(property);
  }

  @Post()
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create property' })
  @ApiStandardCreatedResponse(PropertyResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property payload' })
  @ApiConflictResponse({ description: 'Property code already exists' })
  async create(@Body() createPropertyDto: CreatePropertyDto): Promise<PropertyResponseDto> {
    const property = await this.propertiesService.create(createPropertyDto);

    return this.toResponse(property);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Update property' })
  @ApiStandardOkResponse(PropertyResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or payload' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  @ApiConflictResponse({ description: 'Property code already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ): Promise<PropertyResponseDto> {
    const property = await this.propertiesService.update(id, updatePropertyDto);

    return this.toResponse(property);
  }
}
