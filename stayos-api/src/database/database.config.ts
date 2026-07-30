import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const getDatabaseConfig = (
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConnectionConfig => ({
  host: env.DATABASE_HOST ?? 'localhost',
  port: parseInt(env.DATABASE_PORT ?? '5432', 10),
  database: env.DATABASE_NAME ?? 'stayos',
  username: env.DATABASE_USERNAME ?? 'stayos_user',
  password: env.DATABASE_PASSWORD ?? 'secret',
});

export const createTypeOrmDataSourceOptions = (
  databaseConfig: DatabaseConnectionConfig = getDatabaseConfig(),
): DataSourceOptions => ({
  type: 'postgres',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
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
