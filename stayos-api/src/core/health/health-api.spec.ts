import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { requestIdMiddleware } from '../../common/middleware/request-id.middleware';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('Health API contract', () => {
  let app: INestApplication;
  const healthService = {
    getHealth: jest.fn(),
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableCors({
      origin: ['http://localhost:3000'],
      credentials: true,
    });
    app.use(requestIdMiddleware);
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns the raw health contract', async () => {
    healthService.getHealth.mockReturnValue({
      status: 'ok',
      service: 'StayOS Platform API',
      version: '1.0.0',
      environment: 'development',
      timestamp: '2026-07-01T00:00:00.000Z',
      uptime: 1234,
    });

    await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200)
      .expect('access-control-allow-origin', 'http://localhost:3000')
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ok',
          service: 'StayOS Platform API',
          version: '1.0.0',
          environment: 'development',
          timestamp: '2026-07-01T00:00:00.000Z',
          uptime: 1234,
        });
        expect(body.success).toBeUndefined();
      });
  });

  it('GET /api/v1/health/live returns liveness without dependency checks', async () => {
    healthService.getLiveness.mockReturnValue({
      status: 'ok',
      service: 'StayOS Platform API',
      version: '1.0.0',
      environment: 'development',
      timestamp: '2026-07-01T00:00:00.000Z',
      uptime: 1234,
    });

    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          service: 'StayOS Platform API',
        });
        expect(body.success).toBeUndefined();
      });
  });

  it('GET /api/v1/health/ready returns ready when dependencies are available', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'ready',
      database: {
        status: 'connected',
      },
      environment: 'development',
      timestamp: '2026-07-01T00:00:00.000Z',
      uptime: 1234,
    });

    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ready',
          database: {
            status: 'connected',
          },
          environment: 'development',
          timestamp: '2026-07-01T00:00:00.000Z',
          uptime: 1234,
        });
      });
  });

  it('GET /api/v1/health/ready returns 503 not_ready when database is unavailable', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'not_ready',
      database: {
        status: 'disconnected',
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'not_ready',
          database: {
            status: 'disconnected',
          },
        });
        expect(JSON.stringify(body)).not.toContain('password');
        expect(JSON.stringify(body)).not.toContain('stack');
      });
  });
});
