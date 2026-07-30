import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardListResponse,
  ApiStandardOkResponse,
} from '../../common/decorators/api-standard-response.decorator';
import { AuthService } from './auth.service';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { UserSessionResponseDto } from './dto/user-session-response.dto';
import { Permissions } from './permissions';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('properties/:propertyId/sessions')
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @RequirePermissions(Permissions.SessionsView)
  @ApiOperation({ summary: 'List active and locked sessions for a property' })
  @ApiStandardListResponse(UserSessionResponseDto)
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string): Promise<UserSessionResponseDto[]> {
    return this.authService.listSessions(propertyId);
  }

  @Patch(':sessionId/revoke')
  @RequirePermissions(Permissions.SessionsManage)
  @ApiOperation({ summary: 'Revoke a user session' })
  @ApiStandardOkResponse(UserSessionResponseDto)
  revoke(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<UserSessionResponseDto> {
    return this.authService.revokeSession(propertyId, sessionId);
  }
}
