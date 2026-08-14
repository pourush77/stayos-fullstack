import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { EmployeeEntity } from '../employees/infrastructure/employee.entity';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { MaintenanceTicketEntity } from '../maintenance/infrastructure/maintenance-ticket.entity';
import { PropertiesModule } from '../properties/properties.module';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { HousekeepingController } from './housekeeping.controller';
import { HousekeepingService } from './housekeeping.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomEntity,
      EmployeeEntity,
      ActivityEventEntity,
      AuditEventEntity,
      MaintenanceTicketEntity,
    ]),
    PropertiesModule,
    MaintenanceModule,
  ],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
})
export class HousekeepingModule {}
