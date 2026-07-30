import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FloorEntity } from '../floors/infrastructure/floor.entity';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from './infrastructure/room.entity';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomEntity, FloorEntity, RoomTypeEntity]), PropertiesModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
