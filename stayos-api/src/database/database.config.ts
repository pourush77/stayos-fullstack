import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export const getDatabaseConfig = (env: NodeJS.ProcessEnv = process.env): DatabaseConnectionConfig => {
  if (env.DATABASE_URL?.trim()) {
    const url = new URL(env.DATABASE_URL);

    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 5432,
      database: url.pathname.replace(/^\//, ''),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: env.DATABASE_SSL === 'true',
    };
  }

  return {
    host: env.DATABASE_HOST ?? 'localhost',
    port: parseInt(env.DATABASE_PORT ?? '5432', 10),
    database: env.DATABASE_NAME ?? 'stayos',
    username: env.DATABASE_USERNAME ?? 'stayos_user',
    password: env.DATABASE_PASSWORD ?? 'secret',
    ssl: env.DATABASE_SSL === 'true',
  };
};

export const createTypeOrmDataSourceOptions = (
  databaseConfig: DatabaseConnectionConfig = getDatabaseConfig(),
): DataSourceOptions => ({
  type: 'postgres',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : undefined,
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: false,
});

export const createTypeOrmConfig = (
  databaseConfig: DatabaseConnectionConfig = getDatabaseConfig(),
): TypeOrmModuleOptions => ({
  ...createTypeOrmDataSourceOptions(databaseConfig),
  autoLoadEntities: true,
});
