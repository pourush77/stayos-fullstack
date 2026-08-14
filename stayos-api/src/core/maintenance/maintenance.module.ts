import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/infrastructure/user.entity';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { MaintenanceTicketEntity } from './infrastructure/maintenance-ticket.entity';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceTicketEntity, RoomEntity, UserEntity]), RoomsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
