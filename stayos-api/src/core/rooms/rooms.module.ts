import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesModule } from '../amenities/amenities.module';
import { FloorEntity } from '../floors/infrastructure/floor.entity';
import { PropertiesModule } from '../properties/properties.module';
import { MaintenanceTicketEntity } from '../maintenance/infrastructure/maintenance-ticket.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from './infrastructure/room.entity';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomEntity,
      FloorEntity,
      RoomTypeEntity,
      MaintenanceTicketEntity,
      ReservationEntity,
    ]),
    PropertiesModule,
    AmenitiesModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
