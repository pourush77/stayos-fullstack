import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type HealthStatus = 'ok';
type ReadinessStatus = 'ready' | 'not_ready';
type DatabaseStatus = 'connected' | 'disconnected';

export interface HealthDiagnostics {
  status: HealthStatus;
  service: string;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

export type HealthResponse = HealthDiagnostics;

export interface LivenessResponse extends HealthDiagnostics {
  status: HealthStatus;
}

interface ReadinessBase {
  status: ReadinessStatus;
  database: {
    status: DatabaseStatus;
  };
}

export interface ReadyResponse extends ReadinessBase {
  status: 'ready';
  environment: string;
  timestamp: string;
  uptime: number;
}

export interface NotReadyResponse extends ReadinessBase {
  status: 'not_ready';
}

export type ReadinessResponse = ReadyResponse | NotReadyResponse;

@Injectable()
export class HealthService {
  private readonly serviceName: string;
  private readonly environment: string;
  private readonly version: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.serviceName = this.configService.get<string>('app.name') ?? 'StayOS Platform API';
    this.environment = this.configService.get<string>('app.env') ?? 'development';
    this.version = this.configService.get<string>('app.version') ?? '1.0.0';
  }

  getHealth(): HealthResponse {
    return this.getBaseDiagnostics('ok');
  }

  getLiveness(): LivenessResponse {
    return this.getBaseDiagnostics('ok');
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const isDatabaseConnected = await this.isDatabaseConnected();

    if (!isDatabaseConnected) {
      return {
        status: 'not_ready',
        database: {
          status: 'disconnected',
        },
      };
    }

    return {
      status: 'ready',
      database: {
        status: 'connected',
      },
      environment: this.environment,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    };
  }

  private getBaseDiagnostics(status: HealthStatus): HealthDiagnostics {
    return {
      status,
      service: this.serviceName,
      version: this.version,
      environment: this.environment,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async isDatabaseConnected(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');

      return true;
    } catch {
      return false;
    }
  }
}
