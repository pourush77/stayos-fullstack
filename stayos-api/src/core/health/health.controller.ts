import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { HealthResponse, HealthService, ReadinessResponse } from './health.service';

@ApiTags('Health')
@RawResponse()
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get service health diagnostics' })
  @ApiOkResponse({ description: 'Service health diagnostics' })
  status(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get('live')
  @ApiOperation({ summary: 'Get process liveness' })
  @ApiOkResponse({ description: 'Application process is running' })
  live() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Get deployment readiness' })
  @ApiOkResponse({ description: 'Application is ready to receive traffic' })
  @ApiServiceUnavailableResponse({
    description: 'Application is not ready to receive traffic',
  })
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === 'not_ready') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
