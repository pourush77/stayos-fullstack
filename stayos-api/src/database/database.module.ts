import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createTypeOrmConfig, DatabaseConnectionConfig } from './database.config';

const databaseLogger = new Logger('DatabaseModule');

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseConfig: DatabaseConnectionConfig = {
          host: configService.get<string>('database.host') ?? 'localhost',
          port: configService.get<number>('database.port') ?? 5432,
          database: configService.get<string>('database.name') ?? 'stayos',
          username: configService.get<string>('database.username') ?? 'stayos_user',
          password: configService.get<string>('database.password') ?? 'secret',
        };

        return createTypeOrmConfig(databaseConfig);
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('TypeORM options were not provided');
        }

        const dataSourceOptions = options as DataSourceOptions;
        const connection = dataSourceOptions as DatabaseConnectionConfig;

        try {
          const dataSource = await new DataSource(dataSourceOptions).initialize();

          databaseLogger.log(
            `PostgreSQL connection established: ${connection.host}:${connection.port}/${connection.database}`,
          );

          return dataSource;
        } catch (error) {
          databaseLogger.error(
            `PostgreSQL connection failed: ${connection.host}:${connection.port}/${connection.database}`,
            error instanceof Error ? error.stack : undefined,
          );

          throw error;
        }
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
