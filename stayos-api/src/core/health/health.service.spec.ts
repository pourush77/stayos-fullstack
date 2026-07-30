import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

const configValues: Record<string, unknown> = {
  'app.name': 'StayOS Platform API',
  'app.env': 'test',
  'app.version': '1.0.0',
  'app.port': 3000,
  'database.host': 'localhost',
  'database.port': 5432,
  'database.name': 'stayos_test',
  'database.username': 'stayos',
  'database.password': 'secret',
};

describe('HealthService', () => {
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const dataSource = {
    query: jest.fn(),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns liveness diagnostics without checking dependencies', () => {
    const service = new HealthService(configService, dataSource);

    expect(service.getLiveness()).toMatchObject({
      status: 'ok',
      service: 'StayOS Platform API',
      environment: 'test',
      version: '1.0.0',
    });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('returns base health diagnostics without checking dependencies', () => {
    const service = new HealthService(configService, dataSource);

    expect(service.getHealth()).toMatchObject({
      status: 'ok',
      service: 'StayOS Platform API',
      version: '1.0.0',
      environment: 'test',
    });
    expect(service.getHealth()).toHaveProperty('timestamp');
    expect(service.getHealth()).toHaveProperty('uptime');
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('returns readiness when database and configuration are healthy', async () => {
    jest.spyOn(dataSource, 'query').mockResolvedValue([{ '?column?': 1 }]);
    const service = new HealthService(configService, dataSource);

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      database: { status: 'connected' },
      environment: 'test',
    });
  });

  it('returns not ready without internal errors when database is down', async () => {
    jest.spyOn(dataSource, 'query').mockRejectedValue(new Error('down'));
    const service = new HealthService(configService, dataSource);

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'not_ready',
      database: {
        status: 'disconnected',
      },
    });
  });
});
