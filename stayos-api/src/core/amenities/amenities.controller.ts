import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiStandardCreatedResponse, ApiStandardListResponse, ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { AmenitiesMapper } from './amenities.mapper';
import { AmenitiesService } from './amenities.service';
import { AmenityResponseDto, CreateAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';

@ApiTags('Amenities')
@ApiBearerAuth()
@Controller('properties/:propertyId/amenities')
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get()
  @RequirePermissions(Permissions.RoomsView)
  @ApiStandardListResponse(AmenityResponseDto)
  async findAll(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<AmenityResponseDto[]> {
    return (await this.amenitiesService.findAll(propertyId)).map(AmenitiesMapper.toResponse);
  }

  @Get(':id')
  @RequirePermissions(Permissions.RoomsView)
  @ApiStandardOkResponse(AmenityResponseDto)
  async findOne(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('id', ParseUUIDPipe) id: string): Promise<AmenityResponseDto> {
    return AmenitiesMapper.toResponse(await this.amenitiesService.findOne(propertyId, id));
  }

  @Post()
  @RequirePermissions(Permissions.RoomsManage)
  @ApiStandardCreatedResponse(AmenityResponseDto)
  async create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: CreateAmenityDto): Promise<AmenityResponseDto> {
    return AmenitiesMapper.toResponse(await this.amenitiesService.create(propertyId, dto));
  }

  @Patch(':id')
  @RequirePermissions(Permissions.RoomsManage)
  @ApiStandardOkResponse(AmenityResponseDto)
  async update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAmenityDto,
  ): Promise<AmenityResponseDto> {
    return AmenitiesMapper.toResponse(await this.amenitiesService.update(propertyId, id, dto));
  }

  @Delete(':id')
  @RequirePermissions(Permissions.RoomsManage)
  async remove(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.amenitiesService.remove(propertyId, id);
  }
}
