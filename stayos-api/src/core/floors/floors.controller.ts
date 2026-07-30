import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { PreWrappedSuccessResponse } from '../../common/dto/api-success-response.dto';
import { PaginationMeta, PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  ApiStandardCreatedResponse,
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { CreateFloorDto } from './dto/create-floor.dto';
import { FloorResponseDto } from './dto/floor-response.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsMapper } from './floors.mapper';
import { FloorsService } from './floors.service';

type FloorListResponse = PreWrappedSuccessResponse<FloorResponseDto[]> & {
  message: string;
  pagination?: PaginationMeta;
};

@ApiTags('Floors')
@ApiBearerAuth()
@Controller('properties/:propertyId/floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  @RequirePermissions(Permissions.RoomsView)
  @ApiOperation({ summary: 'List floors for a property' })
  @ApiStandardListResponse(FloorResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or query' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<FloorListResponse> {
    const result = await this.floorsService.findAll(propertyId, query);

    return {
      success: true,
      message: 'Records fetched successfully.',
      data: result.data.map(FloorsMapper.toResponse),
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  @Get(':id')
  @RequirePermissions(Permissions.RoomsView)
  @ApiOperation({ summary: 'Get floor by id' })
  @ApiStandardOkResponse(FloorResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or floor id' })
  @ApiNotFoundResponse({ description: 'Property or floor not found' })
  async findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FloorResponseDto> {
    const floor = await this.floorsService.findOne(propertyId, id);

    return FloorsMapper.toResponse(floor);
  }

  @Post()
  @RequirePermissions(Permissions.RoomsManage)
  @ApiOperation({ summary: 'Create floor' })
  @ApiStandardCreatedResponse(FloorResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid floor payload' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  @ApiConflictResponse({ description: 'Floor code or number already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() createFloorDto: CreateFloorDto,
  ): Promise<FloorResponseDto> {
    const floor = await this.floorsService.create(propertyId, createFloorDto);

    return FloorsMapper.toResponse(floor);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.RoomsManage)
  @ApiOperation({ summary: 'Update floor' })
  @ApiStandardOkResponse(FloorResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid floor payload' })
  @ApiNotFoundResponse({ description: 'Property or floor not found' })
  @ApiConflictResponse({ description: 'Floor code or number already exists' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFloorDto: UpdateFloorDto,
  ): Promise<FloorResponseDto> {
    const floor = await this.floorsService.update(propertyId, id, updateFloorDto);

    return FloorsMapper.toResponse(floor);
  }
}
