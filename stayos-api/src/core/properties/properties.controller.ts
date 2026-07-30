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
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
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
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @RequirePermissions(Permissions.SettingsView, Permissions.RoomsView, Permissions.OperationsView)
  @ApiOperation({ summary: 'List properties' })
  @ApiStandardListResponse(PropertyResponseDto)
  async findAll(@Query() query: PaginationQueryDto): Promise<PropertyListResponse> {
    const result = await this.propertiesService.findAll(query);

    return {
      success: true,
      message: 'Records fetched successfully.',
      data: result.data.map(PropertiesMapper.toResponse),
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

    return PropertiesMapper.toResponse(property);
  }

  @Post()
  @RequirePermissions(Permissions.SettingsManage)
  @ApiOperation({ summary: 'Create property' })
  @ApiStandardCreatedResponse(PropertyResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property payload' })
  @ApiConflictResponse({ description: 'Property code already exists' })
  async create(@Body() createPropertyDto: CreatePropertyDto): Promise<PropertyResponseDto> {
    const property = await this.propertiesService.create(createPropertyDto);

    return PropertiesMapper.toResponse(property);
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

    return PropertiesMapper.toResponse(property);
  }
}
