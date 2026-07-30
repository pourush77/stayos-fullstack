import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = {
    getHealth: jest.fn(),
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('keeps the base health endpoint available', async () => {
    healthService.getHealth.mockReturnValue({ status: 'ok' });

    expect(controller.status()).toEqual({ status: 'ok' });
    expect(healthService.getHealth).toHaveBeenCalledTimes(1);
  });

  it('returns liveness diagnostics', () => {
    healthService.getLiveness.mockReturnValue({ status: 'ok' });

    expect(controller.live()).toEqual({ status: 'ok' });
    expect(healthService.getLiveness).toHaveBeenCalledTimes(1);
  });

  it('returns readiness diagnostics', async () => {
    healthService.getReadiness.mockResolvedValue({ status: 'ready' });
    const response = { status: jest.fn() } as unknown as Response;

    await expect(controller.ready(response)).resolves.toEqual({ status: 'ready' });
    expect(response.status).not.toHaveBeenCalled();
    expect(healthService.getReadiness).toHaveBeenCalledTimes(1);
  });

  it('sets 503 for not-ready diagnostics', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'not_ready',
      database: { status: 'disconnected' },
    });
    const response = { status: jest.fn() } as unknown as Response;

    await expect(controller.ready(response)).resolves.toEqual({
      status: 'not_ready',
      database: { status: 'disconnected' },
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
