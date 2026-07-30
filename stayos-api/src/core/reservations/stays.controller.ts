import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
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
import { ReservationsService } from './reservations.service';

@ApiTags('Stays')
@ApiBearerAuth()
@Controller('properties/:propertyId/stays')
export class StaysController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get(':reservationId')
  @RequirePermissions(Permissions.BookingsView)
  @ApiOperation({ summary: 'Get active stay workspace by reservation id' })
  @ApiStandardOkResponse(Object)
  @ApiBadRequestResponse({ description: 'Invalid property id or reservation id' })
  @ApiNotFoundResponse({ description: 'Property or reservation not found' })
  getStayWorkspace(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
  ) {
    return this.reservationsService.getStayWorkspace(propertyId, reservationId);
  }
}
