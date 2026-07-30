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
import { PreWrappedSuccessResponse } from '../../common/dto/api-success-response.dto';
import { PaginationMeta, PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  ApiStandardCreatedResponse,
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomOperationalStatusNoteDto } from './dto/room-operational-status-note.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsMapper } from './rooms.mapper';
import { RoomsService } from './rooms.service';

type RoomListResponse = PreWrappedSuccessResponse<RoomResponseDto[]> & {
  message: string;
  pagination?: PaginationMeta;
};

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('properties/:propertyId/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @RequirePermissions(Permissions.RoomsView)
  @ApiOperation({ summary: 'List rooms for a property' })
  @ApiStandardListResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or query' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<RoomListResponse> {
    const result = await this.roomsService.findAll(propertyId, query);

    return {
      success: true,
      message: 'Records fetched successfully.',
      data: result.data.map(RoomsMapper.toResponse),
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  @Get(':id')
  @RequirePermissions(Permissions.RoomsView)
  @ApiOperation({ summary: 'Get room by id' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or room id' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.findOne(propertyId, id);

    return RoomsMapper.toResponse(room);
  }

  @Post()
  @RequirePermissions(Permissions.RoomsManage)
  @ApiOperation({ summary: 'Create room' })
  @ApiStandardCreatedResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid room payload' })
  @ApiNotFoundResponse({ description: 'Property, floor, or room type not found' })
  @ApiConflictResponse({ description: 'Room number already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() createRoomDto: CreateRoomDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.create(propertyId, createRoomDto);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.RoomsManage)
  @ApiOperation({ summary: 'Update room' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid room payload' })
  @ApiNotFoundResponse({ description: 'Property, room, floor, or room type not found' })
  @ApiConflictResponse({ description: 'Room number already exists' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.update(propertyId, id, updateRoomDto);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/mark-ready')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Mark room as ready' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or room id' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async markReady(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.markReady(propertyId, id);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/mark-cleaning')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Mark room as needing cleaning' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or room id' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async markCleaning(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.markCleaning(propertyId, id);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/mark-inspection')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Mark room as pending inspection' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or room id' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async markInspection(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.markInspection(propertyId, id);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/block')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Block room from operations' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id, room id, or note payload' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async block(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusNoteDto: RoomOperationalStatusNoteDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.block(propertyId, id, statusNoteDto);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/out-of-service')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Mark room as out of service' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id, room id, or note payload' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async markOutOfService(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusNoteDto: RoomOperationalStatusNoteDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.markOutOfService(propertyId, id, statusNoteDto);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/out-of-order')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Mark room as out of order' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id, room id, or note payload' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async markOutOfOrder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusNoteDto: RoomOperationalStatusNoteDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.markOutOfOrder(propertyId, id, statusNoteDto);

    return RoomsMapper.toResponse(room);
  }

  @Patch(':id/maintenance')
  @RequirePermissions(Permissions.RoomsStatusManage, Permissions.RoomsManage)
  @ApiOperation({ summary: 'Mark room as under maintenance' })
  @ApiStandardOkResponse(RoomResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id, room id, or note payload' })
  @ApiNotFoundResponse({ description: 'Property or room not found' })
  async markMaintenance(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusNoteDto: RoomOperationalStatusNoteDto,
  ): Promise<RoomResponseDto> {
    const room = await this.roomsService.markMaintenance(propertyId, id, statusNoteDto);

    return RoomsMapper.toResponse(room);
  }
}
