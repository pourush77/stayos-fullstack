import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CoreConfigModule } from './core/config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './core/health/health.module';
import { PropertiesModule } from './core/properties/properties.module';
import { FloorsModule } from './core/floors/floors.module';
import { RoomTypesModule } from './core/room-types/room-types.module';
import { RoomsModule } from './core/rooms/rooms.module';
import { GuestsModule } from './core/guests/guests.module';
import { ReservationsModule } from './core/reservations/reservations.module';
import { OperationsModule } from './core/operations/operations.module';
import { AuthModule } from './core/auth/auth.module';
import { EmployeesModule } from './core/employees/employees.module';
import { HousekeepingModule } from './core/housekeeping/housekeeping.module';
import { BillingModule } from './core/billing/billing.module';
import { GuestRequestsModule } from './core/guest-requests/guest-requests.module';
import { ReportsModule } from './core/reports/reports.module';
import { MaintenanceModule } from './core/maintenance/maintenance.module';
import { AmenitiesModule } from './core/amenities/amenities.module';
import configuration from './core/config/configuration';
import { validateEnvironment } from './core/config/environment.validation';
import { GlobalSearchModule } from './core/global-search/global-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                },
              },
      },
    }),
    CoreConfigModule,
    DatabaseModule,
    AuthModule,
    EmployeesModule,
    HealthModule,
    PropertiesModule,
    FloorsModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    OperationsModule,
    HousekeepingModule,
    GuestRequestsModule,
    BillingModule,
    ReportsModule,
    MaintenanceModule,
    AmenitiesModule,
    GlobalSearchModule,
  ],
})
export class AppModule {}
