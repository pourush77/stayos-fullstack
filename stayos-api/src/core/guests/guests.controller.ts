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
import { CreateGuestDto } from './dto/create-guest.dto';
import { GuestResponseDto } from './dto/guest-response.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsMapper } from './guests.mapper';
import { GuestsService } from './guests.service';

type GuestListResponse = PreWrappedSuccessResponse<GuestResponseDto[]> & {
  message: string;
  pagination?: PaginationMeta;
};

@ApiTags('Guests')
@ApiBearerAuth()
@Controller('properties/:propertyId/guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @RequirePermissions(Permissions.GuestsView)
  @ApiOperation({ summary: 'List guests for a property' })
  @ApiStandardListResponse(GuestResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or query' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  async findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<GuestListResponse> {
    const result = await this.guestsService.findAll(propertyId, query);

    return {
      success: true,
      message: 'Records fetched successfully.',
      data: result.data.map(GuestsMapper.toResponse),
      ...(result.pagination ? { pagination: result.pagination } : {}),
    };
  }

  @Get(':id')
  @RequirePermissions(Permissions.GuestsView)
  @ApiOperation({ summary: 'Get guest by id' })
  @ApiStandardOkResponse(GuestResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid property id or guest id' })
  @ApiNotFoundResponse({ description: 'Property or guest not found' })
  async findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GuestResponseDto> {
    const guest = await this.guestsService.findOne(propertyId, id);

    return GuestsMapper.toResponse(guest);
  }

  @Post()
  @RequirePermissions(Permissions.GuestsManage)
  @ApiOperation({ summary: 'Create guest' })
  @ApiStandardCreatedResponse(GuestResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid guest payload' })
  @ApiNotFoundResponse({ description: 'Property not found' })
  @ApiConflictResponse({ description: 'Guest phone already exists' })
  async create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() createGuestDto: CreateGuestDto,
  ): Promise<GuestResponseDto> {
    const guest = await this.guestsService.create(propertyId, createGuestDto);

    return GuestsMapper.toResponse(guest);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.GuestsManage)
  @ApiOperation({ summary: 'Update guest' })
  @ApiStandardOkResponse(GuestResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid guest payload' })
  @ApiNotFoundResponse({ description: 'Property or guest not found' })
  @ApiConflictResponse({ description: 'Guest phone already exists' })
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGuestDto: UpdateGuestDto,
  ): Promise<GuestResponseDto> {
    const guest = await this.guestsService.update(propertyId, id, updateGuestDto);

    return GuestsMapper.toResponse(guest);
  }
}
