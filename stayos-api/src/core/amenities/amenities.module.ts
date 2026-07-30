import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from '../properties/properties.module';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';
import { AmenityEntity } from './infrastructure/amenity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AmenityEntity]), PropertiesModule],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
