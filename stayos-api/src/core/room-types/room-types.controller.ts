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
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { RoomTypeResponseDto } from './dto/room-type-response.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomTypesMapper } from './room-types.mapper';
import { RoomTypesService } from './room-types.service';

type RoomTypeListResponse = PreWrappedSuccessResponse<RoomTypeResponseDto[]> & {
  message: string;
  pagination?: PaginationMeta;
};

@ApiTags('Room Types')
@ApiBearerAuth()
@Controller('properties/:propertyId/room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @Get()
  @RequirePermissions(Permissions.RoomsView)
  @ApiOperation({ summary: 'List room types for a property' })
  @ApiStandardListResponse(RoomTypeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or query' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<RoomTypeListResponse> {
    const result = await this.roomTypesService.findAll(propertyId, query);

    return {
      success: true,
      message: 'Records fetched successfully.',
      data: result.data.map(RoomTypesMapper.toResponse),
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  @Get(':id')
  @RequirePermissions(Permissions.RoomsView)
  @ApiOperation({ summary: 'Get room type by id' })
  @ApiStandardOkResponse(RoomTypeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or room type id' })
  @ApiNotFoundResponse({ description: 'Property or room type not found' })
  async findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomTypeResponseDto> {
    const roomType = await this.roomTypesService.findOne(propertyId, id);

    return RoomTypesMapper.toResponse(roomType);
  }

  @Post()
  @RequirePermissions(Permissions.RoomsManage)
  @ApiOperation({ summary: 'Create room type' })
  @ApiStandardCreatedResponse(RoomTypeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid room type payload' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  @ApiConflictResponse({ description: 'Room type code already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() createRoomTypeDto: CreateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    const roomType = await this.roomTypesService.create(propertyId, createRoomTypeDto);

    return RoomTypesMapper.toResponse(roomType);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.RoomsManage)
  @ApiOperation({ summary: 'Update room type' })
  @ApiStandardOkResponse(RoomTypeResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid room type payload' })
  @ApiNotFoundResponse({ description: 'Property or room type not found' })
  @ApiConflictResponse({ description: 'Room type code already exists' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomTypeDto: UpdateRoomTypeDto,
  ): Promise<RoomTypeResponseDto> {
    const roomType = await this.roomTypesService.update(propertyId, id, updateRoomTypeDto);

    return RoomTypesMapper.toResponse(roomType);
  }
}
