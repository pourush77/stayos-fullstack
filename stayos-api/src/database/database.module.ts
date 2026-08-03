import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createTypeOrmConfig, DatabaseConnectionConfig, getDatabaseConfig } from './database.config';

const databaseLogger = new Logger('DatabaseModule');

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (_configService: ConfigService) => createTypeOrmConfig(getDatabaseConfig()),
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
