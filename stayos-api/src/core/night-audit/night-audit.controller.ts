import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../../common/decorators/api-standard-response.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permissions } from '../auth/permissions';
import { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { NightAuditRunResponseDto } from './dto/night-audit-run-response.dto';
import { NightAuditMapper } from './night-audit.mapper';
import { NightAuditService } from './night-audit.service';

@ApiTags('Night Audit')
@ApiBearerAuth()
@Controller('properties/:propertyId/night-audit')
export class NightAuditController {
  constructor(private readonly nightAuditService: NightAuditService) {}

  @Get()
  @RequirePermissions(Permissions.NightAuditManage)
  @ApiOperation({ summary: 'Get or create open night audit run for property business date' })
  @ApiStandardOkResponse(NightAuditRunResponseDto)
  async getOrCreateOpenRun(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<NightAuditRunResponseDto> {
    const actorUserId = user?.id ?? '00000000-0000-0000-0000-000000000001';
    const { run, workspace, validation } = await this.nightAuditService.getOrCreateOpenRun(
      propertyId,
      actorUserId,
    );
    return NightAuditMapper.toResponse(run, workspace, validation);
  }

  @Post('close')
  @RequirePermissions(Permissions.NightAuditManage)
  @ApiOperation({ summary: 'Atomically close night audit run and advance property business date' })
  @ApiStandardOkResponse(NightAuditRunResponseDto)
  async closeRun(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user?: AuthenticatedRequest['currentUser'],
  ): Promise<NightAuditRunResponseDto> {
    const actorUserId = user?.id ?? '00000000-0000-0000-0000-000000000001';
    const { run, nextBusinessDate } = await this.nightAuditService.closeRun(
      propertyId,
      actorUserId,
    );
    return NightAuditMapper.toResponse(run, undefined, undefined, nextBusinessDate);
  }
}
