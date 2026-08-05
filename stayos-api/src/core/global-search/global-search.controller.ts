import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import { GlobalSearchResponseDto } from './dto/global-search-response.dto';
import { GlobalSearchService } from './global-search.service';

@ApiTags('Global Search')
@ApiBearerAuth()
@Controller('properties/:propertyId/global-search')
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get()
  @RequirePermissions(
    Permissions.GuestsView,
    Permissions.BookingsView,
    Permissions.StayView,
    Permissions.RoomsView,
    Permissions.BillingView,
  )
  @ApiOperation({
    summary: 'Search guests, reservations, in-house stays, rooms and folios',
  })
  @ApiStandardOkResponse(GlobalSearchResponseDto)
  @ApiBadRequestResponse({
    description: 'Invalid property ID or search query',
  })
  @ApiNotFoundResponse({
    description: 'Property not found',
  })
  search(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: GlobalSearchQueryDto,
  ): Promise<GlobalSearchResponseDto> {
    return this.globalSearchService.search(propertyId, query);
  }
}
