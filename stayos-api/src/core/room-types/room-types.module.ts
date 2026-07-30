import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesModule } from '../amenities/amenities.module';
import { PropertiesModule } from '../properties/properties.module';
import { RoomTypeEntity } from './infrastructure/room-type.entity';
import { RoomTypesController } from './room-types.controller';
import { RoomTypesService } from './room-types.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomTypeEntity]), PropertiesModule, AmenitiesModule],
  controllers: [RoomTypesController],
  providers: [RoomTypesService],
  exports: [RoomTypesService],
})
export class RoomTypesModule {}
